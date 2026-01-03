/**
 * Web Worker for file reconstruction and SHA256 verification
 * Offloads heavy computation from the main thread
 */

// SHA256 implementation for workers (Web Crypto not available)
async function sha256(data) {
  // Use SubtleCrypto if available in worker context
  if (self.crypto && self.crypto.subtle) {
    const hashBuffer = await self.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
  
  // Fallback: manual SHA256 (simplified - use library in production)
  throw new Error('SubtleCrypto not available in worker')
}

/**
 * Reconstruct file from sorted chunks
 */
function reconstructFile(sortedChunks, totalSize) {
  const reconstructed = new Uint8Array(totalSize)
  let offset = 0
  
  for (const chunk of sortedChunks) {
    const chunkData = chunk.data.slice(0, chunk.len)
    reconstructed.set(chunkData, offset)
    offset += chunk.len
    
    // Report progress periodically
    if (chunk.chunkIndex % 500 === 0) {
      self.postMessage({
        type: 'progress',
        phase: 'reconstructing',
        current: chunk.chunkIndex,
        total: sortedChunks.length,
        bytes: offset
      })
    }
  }
  
  return reconstructed
}

/**
 * Parse DATA chunk from raw bytes
 */
function parseDataChunk(data) {
  if (!data || data.length < 64) return null
  
  // Check magic
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
  if (magic !== 'DATA') return null
  
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  const cartridgeId = view.getUint32(4, true)
  const chunkIndex = view.getUint32(8, true)
  const len = data[12]
  
  if (len > 51 || data.length < 13 + len) return null
  
  return {
    cartridgeId,
    chunkIndex,
    len,
    data: data.slice(13, 13 + len)
  }
}

/**
 * Main message handler
 */
self.onmessage = async function(e) {
  const { type, payload } = e.data
  
  try {
    switch (type) {
      case 'reconstruct': {
        const { chunks, totalSize, expectedHash, cartridgeId } = payload
        
        self.postMessage({ type: 'status', message: 'Sorting chunks...' })
        
        // Filter and sort chunks
        const validChunks = chunks
          .filter(c => c.cartridgeId === cartridgeId)
          .sort((a, b) => a.chunkIndex - b.chunkIndex)
        
        self.postMessage({ type: 'status', message: 'Reconstructing file...' })
        
        // Reconstruct
        const reconstructed = reconstructFile(validChunks, totalSize)
        
        self.postMessage({ type: 'status', message: 'Verifying SHA256...' })
        
        // Verify hash
        const computedHash = await sha256(reconstructed)
        const verified = computedHash.toLowerCase() === expectedHash.toLowerCase()
        
        // Transfer the buffer back (zero-copy)
        self.postMessage({
          type: 'complete',
          data: reconstructed,
          verified,
          computedHash
        }, [reconstructed.buffer])
        
        break
      }
      
      case 'verify': {
        const { data, expectedHash } = payload
        
        self.postMessage({ type: 'status', message: 'Verifying SHA256...' })
        
        const computedHash = await sha256(data)
        const verified = computedHash.toLowerCase() === expectedHash.toLowerCase()
        
        self.postMessage({
          type: 'verified',
          verified,
          computedHash
        })
        
        break
      }
      
      case 'parseChunks': {
        const { rawData, cartridgeId } = payload
        
        // Parse raw transaction data into chunks
        const chunks = []
        for (const item of rawData) {
          const chunk = parseDataChunk(item.data)
          if (chunk && chunk.cartridgeId === cartridgeId) {
            chunks.push({
              ...chunk,
              txHash: item.txHash
            })
          }
        }
        
        self.postMessage({
          type: 'chunksParsed',
          chunks
        })
        
        break
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    })
  }
}


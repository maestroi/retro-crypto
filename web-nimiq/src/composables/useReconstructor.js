import { ref, shallowRef } from 'vue'

/**
 * Composable for using the reconstruction Web Worker
 * Provides non-blocking file reconstruction and SHA256 verification
 */
export function useReconstructor() {
  const worker = shallowRef(null)
  const isProcessing = ref(false)
  const progress = ref({
    phase: 'idle',
    current: 0,
    total: 0,
    bytes: 0,
    message: ''
  })
  const error = ref(null)

  /**
   * Initialize the worker
   */
  function initWorker() {
    if (worker.value) return worker.value
    
    try {
      worker.value = new Worker(
        new URL('../workers/reconstructor.worker.js', import.meta.url),
        { type: 'module' }
      )
      return worker.value
    } catch (err) {
      console.warn('Web Worker not supported, falling back to main thread:', err)
      return null
    }
  }

  /**
   * Reconstruct file from chunks using Web Worker
   * Falls back to main thread if workers aren't supported
   */
  function reconstructFile(chunks, totalSize, expectedHash, cartridgeId) {
    return new Promise((resolve, reject) => {
      const w = initWorker()
      
      if (!w) {
        // Fallback to main thread
        resolve(reconstructFileMainThread(chunks, totalSize, expectedHash, cartridgeId))
        return
      }
      
      isProcessing.value = true
      error.value = null
      
      w.onmessage = (e) => {
        const { type, ...data } = e.data
        
        switch (type) {
          case 'progress':
            progress.value = {
              phase: data.phase,
              current: data.current,
              total: data.total,
              bytes: data.bytes,
              message: data.message || ''
            }
            break
            
          case 'status':
            progress.value.message = data.message
            break
            
          case 'complete':
            isProcessing.value = false
            progress.value.phase = 'complete'
            resolve({
              data: data.data,
              verified: data.verified,
              computedHash: data.computedHash
            })
            break
            
          case 'error':
            isProcessing.value = false
            error.value = data.error
            reject(new Error(data.error))
            break
        }
      }
      
      w.onerror = (err) => {
        isProcessing.value = false
        error.value = err.message
        reject(err)
      }
      
      // Send data to worker
      w.postMessage({
        type: 'reconstruct',
        payload: {
          chunks,
          totalSize,
          expectedHash,
          cartridgeId
        }
      })
    })
  }

  /**
   * Verify SHA256 hash using Web Worker
   */
  function verifyHash(data, expectedHash) {
    return new Promise((resolve, reject) => {
      const w = initWorker()
      
      if (!w) {
        // Fallback to main thread
        resolve(verifyHashMainThread(data, expectedHash))
        return
      }
      
      isProcessing.value = true
      
      w.onmessage = (e) => {
        const { type, ...result } = e.data
        
        if (type === 'verified') {
          isProcessing.value = false
          resolve({
            verified: result.verified,
            computedHash: result.computedHash
          })
        } else if (type === 'error') {
          isProcessing.value = false
          reject(new Error(result.error))
        }
      }
      
      w.postMessage({
        type: 'verify',
        payload: { data, expectedHash }
      })
    })
  }

  /**
   * Main thread fallback for reconstruction
   */
  async function reconstructFileMainThread(chunks, totalSize, expectedHash, cartridgeId) {
    const validChunks = chunks
      .filter(c => c.cartridgeId === cartridgeId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
    
    const reconstructed = new Uint8Array(totalSize)
    let offset = 0
    
    for (const chunk of validChunks) {
      const chunkData = chunk.data.slice(0, chunk.len)
      reconstructed.set(chunkData, offset)
      offset += chunk.len
    }
    
    // Verify hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', reconstructed)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    const verified = computedHash.toLowerCase() === expectedHash.toLowerCase()
    
    return { data: reconstructed, verified, computedHash }
  }

  /**
   * Main thread fallback for hash verification
   */
  async function verifyHashMainThread(data, expectedHash) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    const verified = computedHash.toLowerCase() === expectedHash.toLowerCase()
    
    return { verified, computedHash }
  }

  /**
   * Terminate the worker
   */
  function terminate() {
    if (worker.value) {
      worker.value.terminate()
      worker.value = null
    }
  }

  return {
    isProcessing,
    progress,
    error,
    reconstructFile,
    verifyHash,
    terminate
  }
}


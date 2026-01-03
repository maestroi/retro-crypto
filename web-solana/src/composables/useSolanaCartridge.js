import { ref, computed } from 'vue'
import { Connection, PublicKey } from '@solana/web3.js'
import { useCache } from './useCache.js'
import { createRateLimiter, isCustomRpcEndpoint } from '../utils.js'
import { IGNORED_CARTRIDGE_HASHES } from '../constants.js'

/**
 * Solana Cartridge loader composable
 * Fetches cartridge manifest and chunks from Solana accounts
 */

// Program constants
const PROGRAM_ID = new PublicKey('iXBRbJjLtohupYmSDz3diKTVz2wU8NXe4gezFsSNcy1')
const MANIFEST_SEED = Buffer.from('manifest')
const CHUNK_SEED = Buffer.from('chunk')

// PDA derivation
function deriveManifestPDA(cartridgeId) {
  const idBytes = typeof cartridgeId === 'string' ? hexToBytes(cartridgeId) : cartridgeId
  return PublicKey.findProgramAddressSync([MANIFEST_SEED, Buffer.from(idBytes)], PROGRAM_ID)
}

function deriveChunkPDA(cartridgeId, chunkIndex) {
  const idBytes = typeof cartridgeId === 'string' ? hexToBytes(cartridgeId) : cartridgeId
  const chunkIndexBuffer = Buffer.alloc(4)
  chunkIndexBuffer.writeUInt32LE(chunkIndex)
  return PublicKey.findProgramAddressSync([CHUNK_SEED, Buffer.from(idBytes), chunkIndexBuffer], PROGRAM_ID)
}

// Decode functions - zero-copy layout with padding
function decodeCartridgeManifest(data) {
  const buffer = Buffer.from(data)
  let offset = 8 // Skip discriminator
  
  const cartridgeId = new Uint8Array(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const zipSize = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const chunkSize = buffer.readUInt32LE(offset)
  offset += 4
  
  const numChunks = buffer.readUInt32LE(offset)
  offset += 4
  
  const sha256 = new Uint8Array(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const finalized = buffer.readUInt8(offset) !== 0
  offset += 1
  
  // Skip finalized padding (7 bytes)
  offset += 7
  
  const createdSlot = buffer.readBigUInt64LE(offset)
  offset += 8
  
  const publisher = new PublicKey(buffer.subarray(offset, offset + 32))
  offset += 32
  
  const metadataLen = buffer.readUInt16LE(offset)
  offset += 2
  
  const bump = buffer.readUInt8(offset)
  offset += 1
  
  // Skip metadata padding (5 bytes)
  offset += 5
  
  const metadata = buffer.subarray(offset, offset + metadataLen)
  
  return {
    cartridgeId,
    zipSize: Number(zipSize),
    chunkSize,
    numChunks,
    sha256,
    finalized,
    createdSlot: Number(createdSlot),
    publisher,
    metadataLen,
    bump,
    metadata
  }
}

// Decode chunk - zero-copy layout with padding (fixed-size array, not Vec)
function decodeCartridgeChunk(data) {
  const buffer = Buffer.from(data)
  let offset = 8 // Skip discriminator
  
  offset += 32 // cartridgeId
  offset += 4 // chunkIndex
  
  const dataLen = buffer.readUInt32LE(offset)
  offset += 4
  
  offset += 1 // written
  offset += 1 // bump
  offset += 6 // padding
  
  // Data is a fixed-size array (not Vec), read dataLen bytes
  const chunkData = new Uint8Array(buffer.subarray(offset, offset + dataLen))
  
  return chunkData
}

// Utility functions
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16)
  }
  return bytes
}

async function verifySHA256(data, expectedHash) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  const expectedHex = expectedHash instanceof Uint8Array 
    ? bytesToHex(expectedHash) 
    : expectedHash
  
  return hashHex.toLowerCase() === expectedHex.toLowerCase()
}

// Detect dev mode
const isDevMode = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

// RPC Proxy endpoints (rate-limited, recommended for downloads)
const RPC_PROXY_PROD = 'https://rpc-solana-retro.maestroi.cc' // Update this to your deployed domain
const RPC_PROXY_LOCAL = 'http://localhost:8899'

// Default RPC endpoints for fallback (useful for larger games)
// Proxy endpoints are preferred as they handle rate limiting gracefully
const DEFAULT_RPC_ENDPOINTS = [
  RPC_PROXY_PROD,  // Production proxy first (handles rate limits)
  RPC_PROXY_LOCAL, // Local proxy as fallback
  'https://api.testnet.solana.com', // Fallback to public testnet
]

export function useSolanaCartridge(rpcEndpoint, cartridgeId) {
  const loading = ref(false)
  const error = ref(null)
  const fileData = ref(null)
  const verified = ref(false)
  const cartHeader = ref(null)
  const progress = ref({
    chunksFound: 0,
    expectedChunks: 0,
    bytes: 0,
    rate: 0,
    phase: 'idle',
    statusMessage: ''
  })

  const cache = useCache()

  // Rate limiter to prevent 429 errors
  // Testnet limits: 40 requests per 10 seconds per RPC endpoint
  // Will be disabled for custom RPC endpoints
  const rateLimiter = createRateLimiter(40, 10000) // 40 requests per 10 seconds

  // Round-robin counter for load balancing across endpoints
  let endpointRoundRobin = 0

  // Get RPC endpoints to use - primary + fallbacks
  // Distributes load across multiple endpoints to avoid rate limits
  function getRpcEndpoints() {
    const primary = rpcEndpoint.value
    if (!primary) return []
    
    // If primary is custom, only use it (no rate limiting)
    const isPrimaryCustom = isCustomRpcEndpoint(primary)
    if (isPrimaryCustom) {
      return [primary]
    }
    
    // For public endpoints, include multiple for load distribution
    const endpoints = [primary]
    
    // Add default RPCs as fallbacks if they're different from primary
    // This helps distribute load across multiple endpoints
    for (const defaultRpc of DEFAULT_RPC_ENDPOINTS) {
      if (defaultRpc !== primary && !endpoints.includes(defaultRpc)) {
        endpoints.push(defaultRpc)
      }
    }
    
    return endpoints
  }

  // Get next endpoint using round-robin for load balancing
  function getNextEndpoint() {
    const endpoints = getRpcEndpoints()
    if (endpoints.length === 0) return null
    
    // Use round-robin to distribute load
    const endpoint = endpoints[endpointRoundRobin % endpoints.length]
    endpointRoundRobin = (endpointRoundRobin + 1) % endpoints.length
    return endpoint
  }

  // Try to fetch with fallback RPCs, using round-robin for load balancing
  async function fetchWithFallback(fetchFn, description) {
    const endpoints = getRpcEndpoints()
    if (endpoints.length === 0) {
      throw new Error('No RPC endpoints available')
    }
    
    // Try primary endpoint first (or round-robin selected)
    let lastError = null
    const maxRetries = endpoints.length * 2 // Try each endpoint up to 2 times
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const endpoint = getNextEndpoint()
      if (!endpoint) break
      
      try {
        // Only rate limit for non-custom endpoints
        const isCustom = isCustomRpcEndpoint(endpoint)
        if (!isCustom && rateLimiter._enabled) {
          await rateLimiter.rateLimit()
        }
        
        const connection = new Connection(endpoint, 'confirmed')
        const result = await fetchFn(connection)
        return result
      } catch (err) {
        // Check if it's a 429 error and handle Retry-After
        if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
          const isCustom = isCustomRpcEndpoint(endpoint)
          if (!isCustom) {
            rateLimiter.handle429Error(err)
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        console.warn(`Failed to ${description} using ${endpoint} (attempt ${attempt + 1}):`, err.message)
        lastError = err
        // Continue to next endpoint
      }
    }
    
    throw lastError || new Error(`Failed to ${description} with all RPC endpoints`)
  }

  const progressPercent = computed(() => {
    if (progress.value.expectedChunks === 0) return 0
    const percent = (progress.value.chunksFound / progress.value.expectedChunks) * 100
    return Math.min(100, Math.max(0, percent))
  })

  /**
   * Load cartridge info (manifest) without downloading chunks
   */
  async function loadCartridgeInfo() {
    if (!cartridgeId.value || !rpcEndpoint.value) {
      error.value = 'Cartridge ID or RPC endpoint not configured'
      return
    }

    // Check if cartridge is in ignore list
    const cartridgeIdHex = typeof cartridgeId.value === 'string' 
      ? cartridgeId.value 
      : bytesToHex(cartridgeId.value)
    
    if (IGNORED_CARTRIDGE_HASHES.has(cartridgeIdHex.toLowerCase())) {
      error.value = 'This cartridge is in the ignore list and cannot be loaded'
      console.log(`Blocked ignored cartridge: ${cartridgeIdHex}`)
      return
    }

    console.log('Loading cartridge info for:', cartridgeId.value)

    try {
      const [manifestPDA] = deriveManifestPDA(cartridgeId.value)
      
      const manifestInfo = await fetchWithFallback(
        async (connection) => await connection.getAccountInfo(manifestPDA),
        'fetch manifest'
      )
      
      if (!manifestInfo) {
        error.value = 'Cartridge manifest not found'
        return
      }

      const manifest = decodeCartridgeManifest(manifestInfo.data)
      
      // Parse metadata if present
      let metadata = {}
      if (manifest.metadataLen > 0) {
        try {
          const metadataStr = new TextDecoder().decode(manifest.metadata)
          metadata = JSON.parse(metadataStr)
        } catch (e) {
          console.warn('Failed to parse manifest metadata:', e)
        }
      }

      cartHeader.value = {
        cartridgeId: bytesToHex(manifest.cartridgeId),
        totalSize: manifest.zipSize,
        chunkSize: manifest.chunkSize,
        numChunks: manifest.numChunks,
        sha256: bytesToHex(manifest.sha256),
        finalized: manifest.finalized,
        createdSlot: manifest.createdSlot,
        publisher: manifest.publisher.toBase58(),
        platform: metadata.platform || 0,
        metadata
      }

      // Check cache
      const cacheKey = {
        cartridgeId: cartHeader.value.cartridgeId,
        sha256: cartHeader.value.sha256
      }
      
      const cachedData = await cache.loadFromCache(cacheKey)
      if (cachedData) {
        const isValid = await verifySHA256(cachedData, manifest.sha256)
        if (isValid) {
          console.log('Loaded from cache')
          fileData.value = cachedData
          verified.value = true
          progress.value = {
            chunksFound: manifest.numChunks,
            expectedChunks: manifest.numChunks,
            bytes: manifest.zipSize,
            rate: 0,
            phase: 'idle'
          }
        } else {
          await cache.clearCache(cacheKey)
        }
      }

    } catch (err) {
      error.value = err.message || 'Failed to load cartridge info'
      console.error('Cartridge info loading error:', err)
    }
  }

  /**
   * Load full cartridge (download all chunks)
   * 
   * OPTIMIZATION: Uses chunk-level caching for:
   * - Instant loads if all chunks are cached
   * - Resumable downloads (only fetches missing chunks)
   * - Parallel batch fetching for uncached chunks
   */
  async function loadCartridge() {
    if (!cartridgeId.value || !rpcEndpoint.value) {
      error.value = 'Cartridge ID or RPC endpoint not configured'
      return
    }

    // If already loaded from cache, return
    if (fileData.value && verified.value && cartHeader.value) {
      console.log('Cartridge already loaded from cache')
      return
    }

    loading.value = true
    error.value = null
    const startTime = Date.now()

    try {
      // First get manifest if not already loaded
      if (!cartHeader.value) {
        await loadCartridgeInfo()
        if (!cartHeader.value) {
          loading.value = false
          return
        }
      }

      const manifest = cartHeader.value
      const numChunks = manifest.numChunks
      const totalBytes = manifest.totalSize
      const cartridgeIdHex = manifest.cartridgeId

      progress.value = {
        chunksFound: 0,
        expectedChunks: numChunks,
        bytes: 0,
        rate: 0,
        phase: 'checking-cache',
        statusMessage: 'Checking cached chunks...'
      }

      // OPTIMIZATION: Check for cached chunks first
      const cachedChunks = await cache.getCachedChunks(cartridgeIdHex, numChunks)
      const chunks = new Array(numChunks).fill(null)
      let chunksLoaded = 0
      let bytesLoaded = 0

      // Load cached chunks into array
      for (const [index, data] of cachedChunks) {
        chunks[index] = data
        chunksLoaded++
        bytesLoaded += data.length
      }

      // Determine which chunks need to be fetched
      const missingIndices = []
      for (let i = 0; i < numChunks; i++) {
        if (chunks[i] === null) {
          missingIndices.push(i)
        }
      }

      // If all chunks are cached, skip fetching
      if (missingIndices.length === 0) {
        console.log(`All ${numChunks} chunks loaded from cache!`)
        progress.value.chunksFound = chunksLoaded
        progress.value.bytes = bytesLoaded
        progress.value.phase = 'reconstructing'
        progress.value.statusMessage = 'Reconstructing from cache...'
      } else {
        console.log(`Fetching ${missingIndices.length}/${numChunks} missing chunks...`)
        
        progress.value = {
          chunksFound: chunksLoaded,
          expectedChunks: numChunks,
          bytes: bytesLoaded,
          rate: 0,
          phase: 'fetching-chunks',
          statusMessage: `Downloading ${missingIndices.length} chunks from Solana...`
        }

        // Derive PDAs only for missing chunks
        const missingChunkPDAs = missingIndices.map(i => {
          const [pda] = deriveChunkPDA(cartridgeId.value, i)
          return { index: i, pda }
        })

        // Fetch missing chunks in parallel batches with CONTROLLED CONCURRENCY
        // to avoid overwhelming RPC endpoints (429 rate limit errors)
        const BATCH_SIZE = 100
        const CONCURRENT_BATCHES = 3 // Fetch 3 batches (300 chunks) at a time
        const endpoints = getRpcEndpoints()

        // Create batch ranges for missing chunks only
        const batchRanges = []
        for (let i = 0; i < missingChunkPDAs.length; i += BATCH_SIZE) {
          const batch = missingChunkPDAs.slice(i, i + BATCH_SIZE)
          batchRanges.push(batch)
        }

        // Fetch batch with retry logic
        const fetchBatch = async (batch) => {
          const pdas = batch.map(({ pda }) => pda)
          let accountInfos = null
          let lastError = null
          
          for (const endpoint of endpoints) {
            try {
              const isCustom = isCustomRpcEndpoint(endpoint)
              if (!isCustom && rateLimiter._enabled) {
                await rateLimiter.rateLimit()
              }
              
              const connection = new Connection(endpoint, 'confirmed')
              accountInfos = await connection.getMultipleAccountsInfo(pdas)
              return { batch, accountInfos }
            } catch (err) {
              if (err.message && (err.message.includes('429') || err.message.includes('Too Many Requests'))) {
                const isCustom = isCustomRpcEndpoint(endpoint)
                if (!isCustom) {
                  rateLimiter.handle429Error(err)
                  await new Promise(resolve => setTimeout(resolve, 1000))
                }
              }
              
              console.warn(`Failed to fetch batch using ${endpoint}:`, err.message)
              lastError = err
            }
          }
          
          throw lastError || new Error(`Failed to fetch batch with all RPC endpoints`)
        }

        // Execute batch fetches with controlled concurrency (not all at once!)
        // This prevents 429 rate limit errors from overwhelming the RPC
        const newChunksToCache = []
        
        for (let i = 0; i < batchRanges.length; i += CONCURRENT_BATCHES) {
          const concurrentBatches = batchRanges.slice(i, i + CONCURRENT_BATCHES)
          const results = await Promise.all(concurrentBatches.map(fetchBatch))
          
          // Process results from this wave
          for (const { batch, accountInfos } of results) {
            if (!accountInfos) continue
            for (let j = 0; j < accountInfos.length; j++) {
              const info = accountInfos[j]
              const { index } = batch[j]
              if (info && info.data) {
                const chunkData = decodeCartridgeChunk(info.data)
                chunks[index] = chunkData
                chunksLoaded++
                bytesLoaded += chunkData.length
                
                // Queue for caching
                newChunksToCache.push({ index, data: chunkData })
              }
            }
          }
          
          // Update progress after each wave
          progress.value.chunksFound = chunksLoaded
          progress.value.bytes = bytesLoaded
          const elapsed = (Date.now() - startTime) / 1000
          if (elapsed > 0) {
            progress.value.rate = chunksLoaded / elapsed
          }
          
          // Small delay between waves to avoid rate limits
          if (i + CONCURRENT_BATCHES < batchRanges.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        // Save newly fetched chunks to cache (background, don't await)
        if (newChunksToCache.length > 0) {
          cache.saveChunks(cartridgeIdHex, newChunksToCache).catch(err => {
            console.warn('Failed to cache chunks:', err)
          })
        }
      }

      // Check for missing chunks
      const stillMissing = chunks.reduce((acc, c, i) => c === null ? [...acc, i] : acc, [])
      if (stillMissing.length > 0) {
        error.value = `Missing ${stillMissing.length} chunks: ${stillMissing.slice(0, 10).join(', ')}${stillMissing.length > 10 ? '...' : ''}`
        loading.value = false
        return
      }

      // Reconstruct ZIP
      progress.value.phase = 'reconstructing'
      progress.value.statusMessage = 'Reconstructing file...'

      const reconstructed = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of chunks) {
        reconstructed.set(chunk, offset)
        offset += chunk.length
      }

      // Verify SHA256
      progress.value.phase = 'verifying'
      progress.value.statusMessage = 'Verifying integrity...'

      const isValid = await verifySHA256(reconstructed, manifest.sha256)
      verified.value = isValid

      if (!isValid) {
        error.value = 'SHA256 verification failed!'
        loading.value = false
        return
      }

      fileData.value = reconstructed

      // Save full file to cache (for instant load next time)
      const cacheKey = {
        cartridgeId: manifest.cartridgeId,
        sha256: manifest.sha256
      }
      await cache.saveToCache(cacheKey, reconstructed)

      progress.value.phase = 'idle'
      progress.value.statusMessage = ''

    } catch (err) {
      error.value = err.message || 'Failed to load cartridge'
      console.error('Cartridge loading error:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Extract run.json from ZIP file
   */
  async function extractRunJson() {
    if (!fileData.value || !verified.value) {
      return null
    }

    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(fileData.value)
      
      const runJsonFile = zip.files['run.json']
      if (!runJsonFile || runJsonFile.dir) {
        return null
      }

      const runJsonText = await runJsonFile.async('string')
      return JSON.parse(runJsonText)
    } catch (err) {
      console.warn('Failed to extract run.json:', err)
      return null
    }
  }

  /**
   * Clear cache for current cartridge
   */
  async function clearCache() {
    if (!cartHeader.value) return
    
    const cacheKey = {
      cartridgeId: cartHeader.value.cartridgeId,
      sha256: cartHeader.value.sha256
    }
    
    await cache.clearCache(cacheKey)
    
    fileData.value = null
    verified.value = false
    progress.value = {
      chunksFound: 0,
      expectedChunks: 0,
      bytes: 0,
      rate: 0,
      phase: 'idle',
      statusMessage: ''
    }
    
    console.log('Cache cleared, cartridge state reset')
  }

  return {
    loading,
    error,
    fileData,
    verified,
    cartHeader,
    progress,
    progressPercent,
    loadCartridgeInfo,
    loadCartridge,
    extractRunJson,
    clearCache
  }
}


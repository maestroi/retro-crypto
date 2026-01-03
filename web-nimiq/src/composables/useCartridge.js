import { ref, computed } from 'vue'
import { parseCART, parseDATA, computeExpectedChunks, verifySHA256, hexToBytes, normalizeAddress, isDataMagicHex } from '../utils/payloads.js'
import { useCache } from './useCache.js'

/**
 * Cartridge loader composable
 * Fetches transactions from CARTRIDGE_ADDRESS, finds CART header, collects DATA chunks, and reconstructs ZIP
 */
export function useCartridge(rpcClient, cartridgeAddress, publisherAddress) {
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
    phase: 'idle', // 'idle', 'fetching-txs', 'parsing-chunks', 'reconstructing', 'verifying'
    statusMessage: '',
    txPagesFetched: 0,
    txTotalFetched: 0,
    txEstimatedPages: 0
  })
  const syncStartTime = ref(null)
  
  // Cache integration
  const cache = useCache()

  const progressPercent = computed(() => {
    if (progress.value.expectedChunks === 0) return 0
    const percent = (progress.value.chunksFound / progress.value.expectedChunks) * 100
    return Math.min(100, Math.max(0, percent))
  })

  /**
   * Check cache and load if available (silent, no loading state)
   */
  async function checkCacheAndLoad(cartData) {
    if (!cartData) return false
    
    try {
      const cacheKey = {
        cartridgeId: cartData.cartridgeId,
        sha256: cartData.sha256
      }
      
      const cachedData = await cache.loadFromCache(cacheKey)
      if (cachedData) {
        // Verify cached data matches expected hash
        const isValid = await verifySHA256(cachedData, cartData.sha256)
        if (isValid) {
          console.log('Loaded from cache silently (found when loading CART header)')
          fileData.value = cachedData
          verified.value = true
          progress.value = {
            chunksFound: computeExpectedChunks(cartData.totalSize, cartData.chunkSize),
            expectedChunks: computeExpectedChunks(cartData.totalSize, cartData.chunkSize),
            bytes: cartData.totalSize,
            rate: 0
          }
          return true
        } else {
          console.warn('Cached data failed verification, will need to re-download')
          await cache.clearCache(cacheKey)
        }
      }
    } catch (err) {
      console.warn('Error checking cache:', err)
    }
    
    return false
  }

  /**
   * Load only CART header info (for display, no download)
   * Optimized to fetch only recent transactions since CART header is uploaded last
   */
  async function loadCartridgeInfo() {
    if (!cartridgeAddress.value || !rpcClient.value) {
      error.value = 'Cartridge address or RPC client not configured'
      return
    }

    console.log('Loading cartridge info from address:', cartridgeAddress.value)

    try {
      // CART header is uploaded AFTER all DATA chunks, so it should be in the most recent transactions
      // Fetch just the first page (most recent transactions) - this should contain the CART header
      const recentTxs = await rpcClient.value.getTransactionsByAddress(
        cartridgeAddress.value,
        500 // Just fetch first 500 (most recent)
      )

      console.log(`Checking ${recentTxs.length} most recent transactions for CART header`)

      // Transactions are already in descending order (newest first) from RPC
      // So we can check them in order
      const normalizedPublisher = publisherAddress.value ? normalizeAddress(publisherAddress.value) : null
      
      for (const tx of recentTxs) {
        const txData = tx.recipientData || tx.data || ''
        if (!txData) continue

        try {
          const data = hexToBytes(txData)
          
          // Check for CART magic
          const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
          if (magic === 'CART') {
            const cart = parseCART(data)
            if (cart) {
              // Found CART header - verify it's from the publisher if publisher is set
              if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
                console.warn(`CART header found but not from publisher (from: ${tx.from}, expected: ${publisherAddress.value}), continuing search...`)
                continue
              }
              
              console.log(`Found CART header: cartridgeId=${cart.cartridgeId}, totalSize=${cart.totalSize}, from=${tx.from}`)
              const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
              cartHeader.value = {
                ...cart,
                txHash: tx.hash,
                height: tx.height || tx.blockNumber || 0,
                publisherVerified: isPublisherVerified,
                fromAddress: tx.from
              }
              
              // Check cache immediately after finding CART header
              await checkCacheAndLoad(cart)
              
              return // Found header, done!
            }
          }
        } catch (err) {
          // Not a valid payload, continue
        }
      }

      // CART header not found in recent transactions - might be an edge case
      // Try fetching a few more pages, but limit to avoid fetching everything
      console.log('CART header not found in most recent transactions, checking a few more pages...')
      let startAt = recentTxs.length > 0 ? recentTxs[recentTxs.length - 1].hash : null
      let pagesChecked = 1
      const maxPages = 5 // Limit to 5 pages max (2500 transactions) to avoid full download

      while (pagesChecked < maxPages && startAt) {
        const nextPageTxs = await rpcClient.value.getTransactionsByAddress(
          cartridgeAddress.value,
          500,
          startAt
        )

        if (nextPageTxs.length === 0) break

        for (const tx of nextPageTxs) {
          const txData = tx.recipientData || tx.data || ''
          if (!txData) continue

          try {
            const data = hexToBytes(txData)
            const magic = String.fromCharCode(data[0], data[1], data[2], data[3])
            if (magic === 'CART') {
              const cart = parseCART(data)
              if (cart) {
                if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
                  continue
                }
                
                console.log(`Found CART header in page ${pagesChecked + 1}: cartridgeId=${cart.cartridgeId}, totalSize=${cart.totalSize}`)
                const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
                cartHeader.value = {
                  ...cart,
                  txHash: tx.hash,
                  height: tx.height || tx.blockNumber || 0,
                  publisherVerified: isPublisherVerified,
                  fromAddress: tx.from
                }
                
                // Check cache immediately after finding CART header
                await checkCacheAndLoad(cart)
                
                return // Found header, done!
              }
            }
          } catch (err) {
            // Continue
          }
        }

        startAt = nextPageTxs.length > 0 ? nextPageTxs[nextPageTxs.length - 1].hash : null
        pagesChecked++
      }

      // No CART header found in limited search
      console.warn('CART header not found in recent transactions')
      cartHeader.value = null
      error.value = 'CART header not found in recent transactions. The cartridge may not be fully uploaded yet.'
    } catch (err) {
      error.value = err.message || 'Failed to load cartridge info'
      console.error('Cartridge info loading error:', err)
    }
  }

  /**
   * Load cartridge from blockchain (full download)
   * OPTIMIZED: Uses streaming + quick magic check + reduced UI yields
   */
  async function loadCartridge() {
    if (!cartridgeAddress.value || !rpcClient.value) {
      error.value = 'Cartridge address or RPC client not configured'
      return
    }

    // If already loaded from cache (during loadCartridgeInfo), just return
    if (fileData.value && verified.value && cartHeader.value) {
      console.log('Cartridge already loaded from cache, skipping download')
      return
    }

    console.log('Loading cartridge from address:', cartridgeAddress.value)

    loading.value = true
    error.value = null
    progress.value = { 
      chunksFound: 0, 
      expectedChunks: 0, 
      bytes: 0, 
      rate: 0, 
      phase: 'idle', 
      statusMessage: '',
      txPagesFetched: 0,
      txTotalFetched: 0,
      txEstimatedPages: 0
    }
    syncStartTime.value = Date.now()

    try {
      // First, quickly find CART header from recent transactions (same optimized approach as loadCartridgeInfo)
      // CART header is uploaded AFTER all DATA chunks, so it's in the most recent transactions
      const normalizedPublisher = publisherAddress.value ? normalizeAddress(publisherAddress.value) : null
      let quickCartData = null
      
      // Fetch just the first page (most recent transactions) to find CART header quickly
      const recentTxs = await rpcClient.value.getTransactionsByAddress(
        cartridgeAddress.value,
        500 // Just fetch first 500 (most recent)
      )
      
      // Transactions are already in descending order (newest first) from RPC
      for (const tx of recentTxs) {
        // Filter by publisher if specified
        if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
          continue
        }
        
        const txData = tx.recipientData || tx.data || ''
        if (!txData) continue

        try {
          const data = hexToBytes(txData)
          const cart = parseCART(data)
          if (cart) {
            quickCartData = cart
            const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
            cartHeader.value = {
              ...cart,
              txHash: tx.hash,
              height: tx.height || tx.blockNumber || 0,
              publisherVerified: isPublisherVerified,
              fromAddress: tx.from
            }
            break
          }
        } catch (err) {
          // Not a CART header, continue
        }
      }
      
      // If not found in first page, check a few more pages (but limit to avoid delay)
      if (!quickCartData) {
        let startAt = recentTxs.length > 0 ? recentTxs[recentTxs.length - 1].hash : null
        let pagesChecked = 1
        const maxPages = 3 // Limit to 3 pages for CART header search
        
        while (pagesChecked < maxPages && startAt) {
          const nextPageTxs = await rpcClient.value.getTransactionsByAddress(
            cartridgeAddress.value,
            500,
            startAt
          )
          
          if (nextPageTxs.length === 0) break
          
          for (const tx of nextPageTxs) {
            if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
              continue
            }
            
            const txData = tx.recipientData || tx.data || ''
            if (!txData) continue
            
            try {
              const data = hexToBytes(txData)
              const cart = parseCART(data)
              if (cart) {
                quickCartData = cart
                const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
                cartHeader.value = {
                  ...cart,
                  txHash: tx.hash,
                  height: tx.height || tx.blockNumber || 0,
                  publisherVerified: isPublisherVerified,
                  fromAddress: tx.from
                }
                break
              }
            } catch (err) {
              // Continue
            }
          }
          
          if (quickCartData) break
          
          startAt = nextPageTxs.length > 0 ? nextPageTxs[nextPageTxs.length - 1].hash : null
          pagesChecked++
        }
      }

      if (!quickCartData) {
        error.value = 'CART header not found in cartridge address transactions'
        loading.value = false
        return
      }

      // Check cache first
      const cacheKey = {
        cartridgeId: quickCartData.cartridgeId,
        sha256: quickCartData.sha256
      }
      
      const cachedData = await cache.loadFromCache(cacheKey)
      if (cachedData) {
        // Verify cached data matches expected hash
        const isValid = await verifySHA256(cachedData, quickCartData.sha256)
        if (isValid) {
          console.log('Loaded from cache, verified successfully')
          fileData.value = cachedData
          verified.value = true
          progress.value = {
            chunksFound: computeExpectedChunks(quickCartData.totalSize, quickCartData.chunkSize),
            expectedChunks: computeExpectedChunks(quickCartData.totalSize, quickCartData.chunkSize),
            bytes: quickCartData.totalSize,
            rate: 0
          }
          loading.value = false
          return
        } else {
          console.warn('Cached data failed verification, re-downloading...')
          // Clear invalid cache
          await cache.clearCache(cacheKey)
        }
      }

      // Not in cache or cache invalid, proceed with full download
      fileData.value = null
      verified.value = false
      
      // Use the already-found CART header
      const cartData = quickCartData
      
      console.log('Found CART header:', cartHeader.value)

      // Compute expected chunks and set immediately so progress bar appears right away
      const expectedChunks = computeExpectedChunks(cartData.totalSize, cartData.chunkSize)
      progress.value.expectedChunks = expectedChunks
      progress.value.chunksFound = 0
      progress.value.phase = 'fetching-txs'
      progress.value.statusMessage = 'Streaming transactions from blockchain...'
      progress.value.txPagesFetched = 0
      progress.value.txTotalFetched = 0
      progress.value.txEstimatedPages = Math.ceil(expectedChunks / 500) // Estimate based on expected chunks
      
      // OPTIMIZED: Stream transactions and parse as they arrive
      // Uses quick magic byte check to skip non-DATA transactions
      console.log('Starting optimized streaming download...')
      const chunks = new Map()
      let lastYieldTime = Date.now()
      
      // Stream transactions and process in batches as they arrive
      await rpcClient.value.streamTransactionsParallel(
        cartridgeAddress.value,
        500,
        async (batchTxs, info) => {
          // Update fetch progress
          progress.value.txPagesFetched = info.page
          progress.value.txTotalFetched = info.totalFetched
          progress.value.txEstimatedPages = Math.max(progress.value.txEstimatedPages, info.page + 2)
          
          // Process batch immediately (parse while fetching continues)
          let batchChunksFound = 0
          
          for (const tx of batchTxs) {
            // Filter by publisher if specified
            if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
              continue
            }
            
            const txData = tx.recipientData || tx.data || ''
            if (!txData) continue
            
            // OPTIMIZATION: Quick magic byte check - skip non-DATA transactions without full parsing
            if (!isDataMagicHex(txData)) {
              continue
            }

            try {
              const data = hexToBytes(txData)
              const dataChunk = parseDATA(data)
              
              if (dataChunk && dataChunk.cartridgeId === cartData.cartridgeId) {
                // Only keep the first occurrence of each chunk index (in case of duplicates)
                if (!chunks.has(dataChunk.chunkIndex)) {
                  chunks.set(dataChunk.chunkIndex, {
                    ...dataChunk,
                    txHash: tx.hash
                  })
                  batchChunksFound++
                }
              }
            } catch (err) {
              // Not a valid DATA chunk, continue
            }
          }
          
          // Update progress after each batch
          progress.value.chunksFound = chunks.size
          progress.value.phase = chunks.size >= expectedChunks ? 'reconstructing' : 'fetching-txs'
          
          // Update rate
          const elapsed = (Date.now() - syncStartTime.value) / 1000
          if (elapsed > 0) {
            progress.value.rate = chunks.size / elapsed
          }
          
          // Yield to UI after each batch to ensure progress bar updates
          // (needed for reactivity to trigger re-render)
          await new Promise(resolve => setTimeout(resolve, 0))
          
          // Early exit if we have all chunks
          if (chunks.size >= expectedChunks) {
            console.log(`Found all ${expectedChunks} chunks, stopping stream early`)
            return false // Signal to stop streaming (if supported)
          }
        },
        { concurrency: 6, maxPages: 200 }
      )
      
      // Final progress update
      progress.value.txEstimatedPages = progress.value.txPagesFetched
      progress.value.phase = 'parsing-chunks'
      progress.value.statusMessage = ''
      
      console.log(`Streaming complete: Found ${chunks.size} of ${expectedChunks} expected chunks`)

      if (chunks.size < expectedChunks) {
        error.value = `Only found ${chunks.size} of ${expectedChunks} expected chunks. Some transactions may not be confirmed yet.`
        loading.value = false
        return
      }

      // Reconstruct file with incremental progress updates
      progress.value.phase = 'reconstructing'
      const sortedChunks = Array.from(chunks.values())
        .sort((a, b) => a.chunkIndex - b.chunkIndex)

      const reconstructed = new Uint8Array(cartData.totalSize)
      let offset = 0
      let totalBytes = 0

      // OPTIMIZATION: Reduced UI yield frequency (every 500 chunks instead of 50)
      for (let i = 0; i < sortedChunks.length; i++) {
        const chunk = sortedChunks[i]
        const chunkData = chunk.data.slice(0, chunk.len)
        reconstructed.set(chunkData, offset)
        offset += chunk.len
        totalBytes += chunk.len
        
        // Update progress incrementally during reconstruction
        progress.value.bytes = totalBytes
        
        // OPTIMIZATION: Update every 500 chunks to avoid too many UI updates
        if (i % 500 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0)) // Yield to UI
        }
      }

      progress.value.bytes = totalBytes
      fileData.value = reconstructed

      // Verify SHA256
      progress.value.phase = 'verifying'
      progress.value.statusMessage = 'Verifying file integrity...'
      console.log('Verifying SHA256...')
      const isValid = await verifySHA256(reconstructed, cartData.sha256)
      verified.value = isValid

      if (!isValid) {
        error.value = `SHA256 verification failed! Expected ${cartData.sha256}, computed hash mismatch.`
      } else {
        console.log('SHA256 verification passed')
        
        // Save to cache after successful verification
        const cacheKey = {
          cartridgeId: cartData.cartridgeId,
          sha256: cartData.sha256,
          filename: 'game.zip' // Will be updated when run.json is extracted
        }
        await cache.saveToCache(cacheKey, reconstructed)
        console.log('Saved to cache')
      }

      // Update progress
      const elapsed = (Date.now() - syncStartTime.value) / 1000
      if (elapsed > 0) {
        progress.value.rate = chunks.size / elapsed
      }
      
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
    
    // Reset state to force re-download
    fileData.value = null
    verified.value = false
    progress.value = {
      chunksFound: 0,
      expectedChunks: 0,
      bytes: 0,
      rate: 0
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


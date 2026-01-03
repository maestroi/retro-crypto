/**
 * Nimiq Protocol Driver
 * 
 * Implements the protocol driver interface for Nimiq blockchain.
 * Uses transaction-based storage with CART/DATA/CENT payload formats.
 */

import { parseCENT, parseCART, parseDATA, hexToBytes, normalizeAddress, computeExpectedChunks, verifySHA256, isDataMagicHex } from '../utils/payloads.js'

/**
 * Nimiq RPC Client
 */
class NimiqRPC {
  constructor(url) {
    this.url = url
    this.id = 1
    this.maxRetries = 3
    this.baseDelay = 1000
  }

  isTransientError(error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true
    if (error.message.includes('network') || error.message.includes('Network')) return true
    if (error.message.includes('Failed to fetch')) return true
    if (error.message.includes('timeout') || error.message.includes('Timeout')) return true
    if (error.message.includes('HTTP 5')) return true
    if (error.message.includes('HTTP 429')) return true
    return false
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async call(method, params = {}) {
    let lastError = null
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const request = {
          jsonrpc: '2.0',
          id: this.id++,
          method: method,
          params: params
        }

        const response = await fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        })

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
          if (response.status >= 500 || response.status === 429) {
            throw error
          }
          throw error
        }

        const data = await response.json()

        if (data.error) {
          throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
        }

        if (data.result && typeof data.result === 'object' && 'data' in data.result) {
          return data.result.data
        }

        return data.result
        
      } catch (error) {
        lastError = error
        
        if (attempt < this.maxRetries - 1 && this.isTransientError(error)) {
          const delay = this.baseDelay * Math.pow(2, attempt)
          console.warn(`RPC call failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms...`, error.message)
          await this.sleep(delay)
          continue
        }
        
        throw error
      }
    }
    
    throw lastError
  }

  normalizeTransaction(tx) {
    if (!tx || typeof tx !== 'object') return null
    
    return {
      hash: tx.hash || tx.Hash || '',
      blockNumber: tx.blockNumber || tx.BlockNumber || tx.block_number || 0,
      height: tx.height || tx.Height || tx.blockNumber || tx.BlockNumber || 0,
      recipientData: tx.recipientData || tx.RecipientData || tx.recipient_data || tx.senderData || tx.SenderData || tx.sender_data || '',
      data: tx.data || tx.Data || tx.recipientData || tx.RecipientData || '',
      from: tx.from || tx.From || '',
      to: tx.to || tx.To || '',
      value: tx.value || tx.Value || 0,
      fee: tx.fee || tx.Fee || 0
    }
  }

  async getTransactionsByAddress(address, max = 500, startAt = null) {
    if (!address) {
      throw new Error('Address is required for getTransactionsByAddress')
    }
    
    const cleanAddress = address.replace(/\s/g, '')
    
    if (!cleanAddress.startsWith('NQ')) {
      throw new Error(`Invalid Nimiq address format: must start with NQ, got ${address}`)
    }
    
    const params = { address: cleanAddress, max }
    if (startAt) {
      params.start_at = startAt
    }
    
    const result = await this.call('getTransactionsByAddress', params)
    
    if (Array.isArray(result)) {
      return result.map(tx => this.normalizeTransaction(tx))
    }
    
    if (result && Array.isArray(result.transactions)) {
      return result.transactions.map(tx => this.normalizeTransaction(tx))
    }
    
    return []
  }

  async getAllTransactionsByAddress(address, max = 500, onProgress = null) {
    const allTransactions = []
    let startAt = null
    let page = 0
    const seenHashes = new Set()
    let consecutiveDuplicatePages = 0
    
    while (true) {
      const transactions = await this.getTransactionsByAddress(address, max, startAt)
      
      if (transactions.length === 0) break
      
      const newTransactions = transactions.filter(tx => !seenHashes.has(tx.hash))
      
      for (const tx of newTransactions) {
        seenHashes.add(tx.hash)
      }
      
      if (newTransactions.length > 0) {
        allTransactions.push(...newTransactions)
        consecutiveDuplicatePages = 0
      } else {
        consecutiveDuplicatePages++
        if (consecutiveDuplicatePages >= 3) break
      }
      
      if (onProgress) {
        const result = onProgress({
          page: page + 1,
          totalFetched: allTransactions.length,
          pageSize: newTransactions.length
        })
        if (result && typeof result.then === 'function') {
          await result
        }
      }
      
      const lastHash = transactions[transactions.length - 1].hash
      
      if (startAt === lastHash) {
        startAt = transactions[0].hash
      } else {
        startAt = lastHash
      }
      
      page++
      
      if (transactions.length < max) break
      if (page >= 100) break
    }
    
    return allTransactions
  }

  async streamTransactionsParallel(address, max = 500, onBatch, options = {}) {
    const { maxPages = 200 } = options
    const seenHashes = new Set()
    let totalFetched = 0
    let pagesCompleted = 0
    
    const startTime = Date.now()
    
    let currentStartAt = null
    let done = false
    let shouldStop = false
    
    while (!done && !shouldStop && pagesCompleted < maxPages) {
      const txs = await this.getTransactionsByAddress(address, max, currentStartAt)
      
      if (txs.length === 0) {
        done = true
        break
      }
      
      const newTxs = txs.filter(tx => !seenHashes.has(tx.hash))
      for (const tx of newTxs) seenHashes.add(tx.hash)
      
      pagesCompleted++
      
      if (newTxs.length > 0) {
        totalFetched += newTxs.length
        
        if (onBatch) {
          const result = onBatch(newTxs, {
            page: pagesCompleted,
            totalFetched,
            rate: totalFetched / ((Date.now() - startTime) / 1000)
          })
          
          if (result && typeof result.then === 'function') {
            const callbackResult = await result
            if (callbackResult === false) {
              shouldStop = true
            }
          } else if (result === false) {
            shouldStop = true
          }
        }
      }
      
      currentStartAt = txs[txs.length - 1]?.hash
      
      if (txs.length < max) {
        done = true
      }
    }
    
    return { totalFetched, pages: pagesCompleted }
  }
}

/**
 * Get platform name from code
 */
function getPlatformName(platformCode) {
  const platforms = {
    0: 'DOS',
    1: 'GB',
    2: 'GBC',
    3: 'NES'
  }
  return platforms[platformCode] || `Platform ${platformCode}`
}

/**
 * Create Nimiq Protocol Driver
 */
export function createNimiqDriver(rpcUrl) {
  const rpc = new NimiqRPC(rpcUrl)
  
  return {
    protocolId: 'nimiq',
    rpcUrl,
    
    /**
     * Load catalog of games from Nimiq blockchain
     */
    async loadCatalog(catalogAddress, publisherAddress = null, showRetiredRef = null) {
      if (!catalogAddress) {
        throw new Error('Catalog address not configured')
      }

      const transactions = await rpc.getAllTransactionsByAddress(
        catalogAddress,
        500,
        (progress) => {
          console.log(`Loading catalog: page ${progress.page}, ${progress.totalFetched} entries`)
        }
      )

      console.log(`Fetched ${transactions.length} transactions from catalog address`)

      const entries = []
      const normalizedPublisher = publisherAddress ? normalizeAddress(publisherAddress) : null
      
      for (const tx of transactions) {
        if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
          continue
        }

        const txData = tx.recipientData || tx.data || ''
        if (!txData) continue

        try {
          const data = hexToBytes(txData)
          const cent = parseCENT(data)
          
          if (cent) {
            entries.push({
              ...cent,
              txHash: tx.hash,
              height: tx.height,
              blockNumber: tx.blockNumber
            })
          }
        } catch (err) {
          console.warn(`Failed to parse CENT from tx ${tx.hash}:`, err)
        }
      }

      console.log(`Parsed ${entries.length} CENT entries`)

      const FLAG_RETIRED = 0x01
      
      const retiredAppIds = new Set()
      for (const entry of entries) {
        if (entry.flags & FLAG_RETIRED) {
          retiredAppIds.add(entry.appId)
        }
      }
      
      const gamesMap = new Map()
      const shouldShowRetired = showRetiredRef?.value ?? false
      
      for (const entry of entries) {
        if (retiredAppIds.has(entry.appId) && !shouldShowRetired) {
          continue
        }
        
        if (!gamesMap.has(entry.appId)) {
          gamesMap.set(entry.appId, {
            appId: entry.appId,
            title: entry.title || `App ${entry.appId}`,
            platform: getPlatformName(entry.platform),
            retired: retiredAppIds.has(entry.appId),
            versions: []
          })
        }
        
        const game = gamesMap.get(entry.appId)
        game.versions.push({
          semver: entry.semver,
          cartridgeAddress: entry.cartridgeAddress,
          flags: entry.flags,
          txHash: entry.txHash,
          height: entry.height,
          blockNumber: entry.blockNumber
        })
      }

      for (const game of gamesMap.values()) {
        game.versions.sort((a, b) => {
          if (a.semver.major !== b.semver.major) return b.semver.major - a.semver.major
          if (a.semver.minor !== b.semver.minor) return b.semver.minor - a.semver.minor
          if (a.semver.patch !== b.semver.patch) return b.semver.patch - a.semver.patch
          return b.height - a.height
        })
      }

      const games = Array.from(gamesMap.values())
      games.sort((a, b) => b.appId - a.appId)

      return games
    },

    /**
     * Load cartridge header info (CART) without downloading data
     */
    async loadCartridgeInfo(cartridgeAddress, publisherAddress = null) {
      if (!cartridgeAddress) {
        throw new Error('Cartridge address not configured')
      }

      const normalizedPublisher = publisherAddress ? normalizeAddress(publisherAddress) : null
      
      // CART header is uploaded AFTER all DATA chunks, so it's in most recent transactions
      const recentTxs = await rpc.getTransactionsByAddress(cartridgeAddress, 500)

      for (const tx of recentTxs) {
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
              
              const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
              return {
                cartridgeId: cart.cartridgeId,
                totalSize: cart.totalSize,
                chunkSize: cart.chunkSize,
                sha256: cart.sha256,
                platform: getPlatformName(cart.platform),
                txHash: tx.hash,
                height: tx.height || tx.blockNumber || 0,
                publisherVerified: isPublisherVerified,
                fromAddress: tx.from
              }
            }
          }
        } catch (err) {
          // Not a valid CART, continue
        }
      }

      // Check a few more pages if not found
      let startAt = recentTxs.length > 0 ? recentTxs[recentTxs.length - 1].hash : null
      let pagesChecked = 1
      const maxPages = 5

      while (pagesChecked < maxPages && startAt) {
        const nextPageTxs = await rpc.getTransactionsByAddress(cartridgeAddress, 500, startAt)
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
                
                const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
                return {
                  cartridgeId: cart.cartridgeId,
                  totalSize: cart.totalSize,
                  chunkSize: cart.chunkSize,
                  sha256: cart.sha256,
                  platform: getPlatformName(cart.platform),
                  txHash: tx.hash,
                  height: tx.height || tx.blockNumber || 0,
                  publisherVerified: isPublisherVerified,
                  fromAddress: tx.from
                }
              }
            }
          } catch (err) {
            // Continue
          }
        }

        startAt = nextPageTxs.length > 0 ? nextPageTxs[nextPageTxs.length - 1].hash : null
        pagesChecked++
      }

      return null
    },

    /**
     * Load full cartridge (download all chunks and verify)
     */
    async loadCartridge(cartridgeAddress, publisherAddress = null, onProgress = () => {}) {
      if (!cartridgeAddress) {
        throw new Error('Cartridge address not configured')
      }

      const normalizedPublisher = publisherAddress ? normalizeAddress(publisherAddress) : null
      
      // First find CART header
      let cartData = null
      let cartHeader = null
      
      const recentTxs = await rpc.getTransactionsByAddress(cartridgeAddress, 500)
      
      for (const tx of recentTxs) {
        if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
          continue
        }
        
        const txData = tx.recipientData || tx.data || ''
        if (!txData) continue

        try {
          const data = hexToBytes(txData)
          const cart = parseCART(data)
          if (cart) {
            cartData = cart
            const isPublisherVerified = normalizedPublisher ? normalizeAddress(tx.from) === normalizedPublisher : true
            cartHeader = {
              ...cart,
              txHash: tx.hash,
              height: tx.height || tx.blockNumber || 0,
              publisherVerified: isPublisherVerified,
              fromAddress: tx.from
            }
            break
          }
        } catch (err) {
          // Not a CART header
        }
      }

      if (!cartData) {
        throw new Error('CART header not found in cartridge address transactions')
      }

      const expectedChunks = computeExpectedChunks(cartData.totalSize, cartData.chunkSize)
      const startTime = Date.now()
      
      onProgress({
        chunksFound: 0,
        expectedChunks,
        bytes: 0,
        rate: 0,
        phase: 'fetching-txs',
        statusMessage: 'Streaming transactions from blockchain...',
        txPagesFetched: 0,
        txTotalFetched: 0,
        txEstimatedPages: Math.ceil(expectedChunks / 500)
      })

      const chunks = new Map()
      
      await rpc.streamTransactionsParallel(
        cartridgeAddress,
        500,
        async (batchTxs, info) => {
          onProgress({
            chunksFound: chunks.size,
            expectedChunks,
            bytes: 0,
            rate: chunks.size / ((Date.now() - startTime) / 1000),
            phase: chunks.size >= expectedChunks ? 'reconstructing' : 'fetching-txs',
            statusMessage: 'Streaming transactions from blockchain...',
            txPagesFetched: info.page,
            txTotalFetched: info.totalFetched,
            txEstimatedPages: Math.max(Math.ceil(expectedChunks / 500), info.page + 2)
          })
          
          for (const tx of batchTxs) {
            if (normalizedPublisher && normalizeAddress(tx.from) !== normalizedPublisher) {
              continue
            }
            
            const txData = tx.recipientData || tx.data || ''
            if (!txData) continue
            
            if (!isDataMagicHex(txData)) {
              continue
            }

            try {
              const data = hexToBytes(txData)
              const dataChunk = parseDATA(data)
              
              if (dataChunk && dataChunk.cartridgeId === cartData.cartridgeId) {
                if (!chunks.has(dataChunk.chunkIndex)) {
                  chunks.set(dataChunk.chunkIndex, {
                    ...dataChunk,
                    txHash: tx.hash
                  })
                }
              }
            } catch (err) {
              // Not a valid DATA chunk
            }
          }
          
          if (chunks.size >= expectedChunks) {
            return false // Stop streaming
          }
        },
        { concurrency: 6, maxPages: 200 }
      )

      if (chunks.size < expectedChunks) {
        throw new Error(`Only found ${chunks.size} of ${expectedChunks} expected chunks`)
      }

      // Reconstruct file
      onProgress({
        chunksFound: chunks.size,
        expectedChunks,
        bytes: 0,
        rate: 0,
        phase: 'reconstructing',
        statusMessage: 'Reconstructing file...'
      })

      const sortedChunks = Array.from(chunks.values()).sort((a, b) => a.chunkIndex - b.chunkIndex)
      const reconstructed = new Uint8Array(cartData.totalSize)
      let offset = 0
      let totalBytes = 0

      for (const chunk of sortedChunks) {
        const chunkData = chunk.data.slice(0, chunk.len)
        reconstructed.set(chunkData, offset)
        offset += chunk.len
        totalBytes += chunk.len
      }

      // Verify SHA256
      onProgress({
        chunksFound: chunks.size,
        expectedChunks,
        bytes: totalBytes,
        rate: 0,
        phase: 'verifying',
        statusMessage: 'Verifying file integrity...'
      })

      const isValid = await verifySHA256(reconstructed, cartData.sha256)

      if (!isValid) {
        throw new Error(`SHA256 verification failed! Expected ${cartData.sha256}`)
      }

      return {
        fileData: reconstructed,
        verified: true,
        cartHeader
      }
    }
  }
}


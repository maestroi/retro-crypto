// Nimiq RPC Client for browser
export class NimiqRPC {
  constructor(url) {
    this.url = url
    this.id = 1
    this.maxRetries = 3
    this.baseDelay = 1000 // 1 second base delay for exponential backoff
  }

  /**
   * Check if an error is transient (worth retrying)
   */
  isTransientError(error) {
    // Network errors (fetch failed)
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true
    // Network-related messages
    if (error.message.includes('network') || error.message.includes('Network')) return true
    if (error.message.includes('Failed to fetch')) return true
    if (error.message.includes('timeout') || error.message.includes('Timeout')) return true
    // HTTP 5xx errors (server issues)
    if (error.message.includes('HTTP 5')) return true
    // HTTP 429 (rate limited)
    if (error.message.includes('HTTP 429')) return true
    return false
  }

  /**
   * Sleep for specified milliseconds
   */
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
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        })

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
          // Retry on 5xx or 429 errors
          if (response.status >= 500 || response.status === 429) {
            throw error
          }
          // Don't retry on 4xx (except 429) - these are client errors
          throw error
        }

        const data = await response.json()

        if (data.error) {
          throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
        }

        // Handle nested data structure (some RPC endpoints wrap in {data: ...})
        if (data.result && typeof data.result === 'object' && 'data' in data.result) {
          return data.result.data
        }

        return data.result
        
      } catch (error) {
        lastError = error
        
        // Check if we should retry
        if (attempt < this.maxRetries - 1 && this.isTransientError(error)) {
          const delay = this.baseDelay * Math.pow(2, attempt) // Exponential backoff: 1s, 2s, 4s
          console.warn(`RPC call failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms...`, error.message)
          await this.sleep(delay)
          continue
        }
        
        // Either non-transient error or max retries reached
        throw error
      }
    }
    
    // Should never reach here, but just in case
    throw lastError
  }

  async getTransactionByHash(txHash) {
    const result = await this.call('getTransactionByHash', { hash: txHash })
    
    // Handle different response formats
    if (typeof result === 'string') {
      // Direct string response
      return { hash: result }
    }
    
    if (result && typeof result === 'object') {
      // Object response - normalize field names
      return {
        hash: result.hash || result.Hash || txHash,
        blockNumber: result.blockNumber || result.BlockNumber || result.block_number || 0,
        height: result.height || result.Height || result.blockNumber || result.BlockNumber || 0,
        recipientData: result.recipientData || result.RecipientData || result.recipient_data || result.senderData || result.SenderData || result.sender_data || '',
        data: result.data || result.Data || result.recipientData || result.RecipientData || '',
        from: result.from || result.From || '',
        to: result.to || result.To || '',
        value: result.value || result.Value || 0,
        fee: result.fee || result.Fee || 0
      }
    }
    
    return result
  }

  /**
   * Get transactions by address with paging support
   * @param {string} address - Nimiq address (NQ...)
   * @param {number} max - Maximum number of transactions per page
   * @param {string} startAt - Optional transaction hash to start at (for paging)
   * @returns {Promise<Array>} Array of normalized transaction objects
   */
  async getTransactionsByAddress(address, max = 500, startAt = null) {
    if (!address) {
      throw new Error('Address is required for getTransactionsByAddress')
    }
    
    // Remove spaces from address (Nimiq addresses are often formatted with spaces)
    const cleanAddress = address.replace(/\s/g, '')
    
    // Validate address format - Nimiq addresses can be:
    // - Base32: "NQ" + 34 base32 chars = 36 chars total
    // - Hex: "NQ" + 40 hex chars = 42 chars total
    if (!cleanAddress.startsWith('NQ')) {
      throw new Error(`Invalid Nimiq address format: must start with NQ, got ${address}`)
    }
    
    const addressPart = cleanAddress.slice(2)
    if (addressPart.length !== 34 && addressPart.length !== 40) {
      console.warn(`Unexpected address length: ${addressPart.length} chars after NQ (expected 34 base32 or 40 hex)`)
      // Continue anyway - let RPC server validate
    }
    
    const params = { address: cleanAddress, max }
    if (startAt) {
      params.start_at = startAt  // Note: Nimiq RPC uses snake_case
    }
    
    console.log('Calling getTransactionsByAddress with params:', { address: cleanAddress, max, startAt })
    const result = await this.call('getTransactionsByAddress', params)
    
    // Handle array of transactions
    if (Array.isArray(result)) {
      return result.map(tx => this.normalizeTransaction(tx))
    }
    
    // Handle wrapped response
    if (result && Array.isArray(result.transactions)) {
      return result.transactions.map(tx => this.normalizeTransaction(tx))
    }
    
    return []
  }

  /**
   * Normalize transaction object from various RPC response formats
   */
  normalizeTransaction(tx) {
    if (!tx || typeof tx !== 'object') {
      return null
    }
    
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

  /**
   * Paging helper for getTransactionsByAddress
   * Fetches all transactions by calling getTransactionsByAddress repeatedly
   * RPC returns transactions in descending order (newest first)
   * startAt is exclusive - returns transactions BEFORE (older than) that hash
   */
  async getAllTransactionsByAddress(address, max = 500, onProgress = null) {
    const allTransactions = []
    let startAt = null
    let page = 0
    const seenHashes = new Set() // Track seen hashes to deduplicate
    let consecutiveDuplicatePages = 0
    
    while (true) {
      const transactions = await this.getTransactionsByAddress(address, max, startAt)
      
      console.log(`Page ${page + 1}: received ${transactions.length} transactions, startAt=${startAt}`)
      
      if (transactions.length === 0) {
        console.log('Empty page received, pagination complete')
        break
      }
      
      // Log first and last hash for debugging
      if (transactions.length > 0) {
        console.log(`  First hash: ${transactions[0].hash}`)
        console.log(`  Last hash: ${transactions[transactions.length - 1].hash}`)
      }
      
      // Filter out any transactions we've already seen
      const newTransactions = transactions.filter(tx => !seenHashes.has(tx.hash))
      
      console.log(`  New transactions: ${newTransactions.length} (${transactions.length - newTransactions.length} duplicates)`)
      
      // Add new transaction hashes to seen set
      for (const tx of newTransactions) {
        seenHashes.add(tx.hash)
      }
      
      if (newTransactions.length > 0) {
        allTransactions.push(...newTransactions)
        consecutiveDuplicatePages = 0
      } else {
        consecutiveDuplicatePages++
        // If we get 3 consecutive pages of all duplicates, something is wrong - stop
        if (consecutiveDuplicatePages >= 3) {
          console.warn('3 consecutive pages of duplicates, stopping pagination')
          break
        }
      }
      
      // Update progress callback if provided
      if (onProgress) {
        const result = onProgress({
          page: page + 1,
          totalFetched: allTransactions.length,
          pageSize: newTransactions.length
        })
        // If callback returns a promise, wait for it (allows UI updates)
        if (result && typeof result.then === 'function') {
          await result
        }
      }
      
      // Use the oldest transaction hash (last in descending list) as next startAt
      const lastHash = transactions[transactions.length - 1].hash
      
      // If startAt hasn't changed, we're stuck - try with first hash instead
      if (startAt === lastHash) {
        console.warn('startAt unchanged, trying with first hash')
        startAt = transactions[0].hash
      } else {
        startAt = lastHash
      }
      
      page++
      
      // If original response had fewer than max, we've reached the end
      if (transactions.length < max) {
        console.log(`Got ${transactions.length} < ${max}, pagination complete`)
        break
      }
      
      // Maximum pages safety limit
      if (page >= 100) {
        console.warn('Reached maximum page limit (100), stopping')
        break
      }
    }
    
    console.log(`getAllTransactionsByAddress complete: ${allTransactions.length} total transactions in ${page + 1} pages`)
    return allTransactions
  }

  /**
   * OPTIMIZED: High-throughput streaming with per-page callbacks
   * Fetches pages sequentially (required for pagination) but calls onBatch after each page
   * for smooth progress updates
   * 
   * @param {string} address - Nimiq address
   * @param {number} max - Page size
   * @param {function} onBatch - Callback for each page of transactions
   * @param {object} options - Options { maxPages: 200 }
   */
  async streamTransactionsParallel(address, max = 500, onBatch, options = {}) {
    const { maxPages = 200 } = options
    const seenHashes = new Set()
    let totalFetched = 0
    let pagesCompleted = 0
    
    console.log(`[Stream] Starting page-by-page streaming`)
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
      
      // Deduplicate
      const newTxs = txs.filter(tx => !seenHashes.has(tx.hash))
      for (const tx of newTxs) seenHashes.add(tx.hash)
      
      pagesCompleted++
      
      if (newTxs.length > 0) {
        totalFetched += newTxs.length
        
        // Call onBatch after each page for smooth progress updates
        if (onBatch) {
          const result = onBatch(newTxs, {
            page: pagesCompleted,
            totalFetched,
            rate: totalFetched / ((Date.now() - startTime) / 1000)
          })
          
          // Handle async callback
          if (result && typeof result.then === 'function') {
            const callbackResult = await result
            // Allow callback to signal early stop
            if (callbackResult === false) {
              shouldStop = true
            }
          } else if (result === false) {
            shouldStop = true
          }
        }
      }
      
      // Update pagination cursor
      currentStartAt = txs[txs.length - 1]?.hash
      
      // Check if this is the last page
      if (txs.length < max) {
        done = true
      }
    }
    
    const elapsed = (Date.now() - startTime) / 1000
    console.log(`[Stream] Complete: ${totalFetched} transactions in ${pagesCompleted} pages (${elapsed.toFixed(2)}s, ${(totalFetched/elapsed).toFixed(0)} tx/s)`)
    
    return { totalFetched, pages: pagesCompleted }
  }
}

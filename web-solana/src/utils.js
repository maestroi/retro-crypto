export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export function formatHash(hash) {
  if (!hash) return ''
  // Show first 8 and last 8 characters with ellipsis in between
  if (hash.length > 20) {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`
  }
  return hash
}

export function formatAddress(address) {
  if (!address) return ''
  // Show first 8 and last 8 characters with ellipsis in between
  if (address.length > 20) {
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`
  }
  return address
}

export function formatTimeRemaining(seconds) {
  if (!seconds || !isFinite(seconds)) return 'Calculating...'
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
}

/**
 * Rate limiter to prevent 429 errors
 * Matches Solana Testnet limits:
 * - 100 requests per 10 seconds per IP (across all RPCs)
 * - 40 requests per 10 seconds per IP for a single RPC
 * Supports Retry-After header from 429 responses
 */
export function createRateLimiter(maxRequestsPer10Seconds = 40, windowMs = 10000) {
  const requestTimestamps = []
  const minDelay = windowMs / maxRequestsPer10Seconds // Minimum delay between requests in ms
  let retryAfterUntil = 0 // Timestamp until which we should wait due to Retry-After

  return {
    async rateLimit() {
      const now = Date.now()
      
      // Check if we're still in a Retry-After period
      if (now < retryAfterUntil) {
        const waitTime = retryAfterUntil - now
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      // Remove timestamps older than the window
      while (requestTimestamps.length > 0 && Date.now() - requestTimestamps[0] >= windowMs) {
        requestTimestamps.shift()
      }
      
      // If we've hit the limit, wait until we can make another request
      if (requestTimestamps.length >= maxRequestsPer10Seconds) {
        const oldestTimestamp = requestTimestamps[0]
        const waitTime = windowMs - (Date.now() - oldestTimestamp) + 50 // Add 50ms buffer
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
        // Clean up again after waiting
        const newNow = Date.now()
        while (requestTimestamps.length > 0 && newNow - requestTimestamps[0] >= windowMs) {
          requestTimestamps.shift()
        }
      }
      
      // Record this request
      requestTimestamps.push(Date.now())
      
      // Ensure minimum delay between requests to smooth out the load
      if (requestTimestamps.length > 1) {
        const lastRequest = requestTimestamps[requestTimestamps.length - 2]
        const timeSinceLastRequest = Date.now() - lastRequest
        if (timeSinceLastRequest < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest))
          requestTimestamps[requestTimestamps.length - 1] = Date.now() // Update timestamp
        }
      }
    },
    
    /**
     * Handle 429 error with Retry-After header
     * @param {Error} error - The error that may contain Retry-After info
     * @param {Response} response - Optional response object with headers
     */
    handle429Error(error, response = null) {
      let retryAfterSeconds = null
      
      // Try to extract Retry-After from response headers
      if (response && response.headers) {
        const retryAfterHeader = response.headers.get('Retry-After')
        if (retryAfterHeader) {
          retryAfterSeconds = parseInt(retryAfterHeader, 10)
        }
      }
      
      // Try to extract from error object properties
      if (!retryAfterSeconds && error) {
        // Check if error has response property (fetch API)
        if (error.response) {
          if (error.response.headers) {
            const retryAfterHeader = error.response.headers.get('Retry-After')
            if (retryAfterHeader) {
              retryAfterSeconds = parseInt(retryAfterHeader, 10)
            }
          }
          // Check response body for JSON-RPC errors
          if (!retryAfterSeconds && error.response.data) {
            try {
              const data = typeof error.response.data === 'string' 
                ? JSON.parse(error.response.data) 
                : error.response.data
              if (data.retryAfter || data.retry_after) {
                retryAfterSeconds = parseInt(data.retryAfter || data.retry_after, 10)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
        
        // Check error message for retry-after info (various formats)
        if (!retryAfterSeconds && error.message) {
          // Try "Retry-After: 5" format
          let match = error.message.match(/retry[-\s]after[:\s]+(\d+)/i)
          if (match) {
            retryAfterSeconds = parseInt(match[1], 10)
          }
          
          // Try "retry after 5 seconds" format
          if (!retryAfterSeconds) {
            match = error.message.match(/retry[-\s]after[:\s]+(\d+)[\s]*second/i)
            if (match) {
              retryAfterSeconds = parseInt(match[1], 10)
            }
          }
          
          // Try JSON in error message
          if (!retryAfterSeconds) {
            try {
              const jsonMatch = error.message.match(/\{[\s\S]*"retryAfter"[\s]*:[\s]*(\d+)[\s\S]*\}/i)
              if (jsonMatch) {
                retryAfterSeconds = parseInt(jsonMatch[1], 10)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      
      // Default to 1 second if no Retry-After found
      if (!retryAfterSeconds || isNaN(retryAfterSeconds)) {
        retryAfterSeconds = 1
      }
      
      // Set retry after timestamp (add small buffer)
      retryAfterUntil = Date.now() + (retryAfterSeconds * 1000) + 100
      
      console.warn(`Rate limited (429). Waiting ${retryAfterSeconds} seconds before retrying.`)
    },
    
    /**
     * Check if rate limiting should be applied
     * @param {boolean} enabled - Whether rate limiting is enabled
     */
    setEnabled(enabled) {
      this._enabled = enabled !== false
    },
    
    _enabled: true
  }
}

/**
 * Check if an RPC endpoint is a custom/private endpoint (not a default public one)
 * Custom endpoints should not be rate limited
 */
export function isCustomRpcEndpoint(url) {
  if (!url) return false
  
  const defaultEndpoints = [
    'https://api.testnet.solana.com',
    'https://api.devnet.solana.com',
    'https://api.mainnet-beta.solana.com',
    'https://rpc.testnet.soo.network',
    'http://localhost:8899'
  ]
  
  // Check if it's a default endpoint
  const isDefault = defaultEndpoints.some(defaultUrl => url.includes(defaultUrl))
  
  // If it's not a default endpoint, it's custom
  return !isDefault
}

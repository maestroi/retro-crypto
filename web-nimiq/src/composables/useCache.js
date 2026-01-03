const CACHE_DB_NAME = 'nimiq-doom-cache'
const CACHE_DB_VERSION = 1
const CACHE_STORE_NAME = 'game-files'
const DEFAULT_MAX_CACHE_SIZE_MB = 200 // 200MB default limit

let cacheDB = null

export function useCache() {
  async function initCache() {
    if (cacheDB) return cacheDB
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        cacheDB = request.result
        resolve(cacheDB)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * Get all cache entries with their sizes
   */
  async function getAllCacheEntries() {
    try {
      const db = await initCache()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readonly')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.getAll()
        
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Failed to get cache entries:', err)
      return []
    }
  }

  /**
   * Get total cache size in bytes
   */
  async function getCacheSize() {
    const entries = await getAllCacheEntries()
    return entries.reduce((sum, entry) => sum + (entry.data?.length || 0), 0)
  }

  /**
   * Enforce cache size limit using LRU (Least Recently Used) eviction
   * Removes oldest entries until cache is under the limit
   * @param {number} maxSizeMB - Maximum cache size in megabytes (default: 200MB)
   */
  async function enforceCacheLimit(maxSizeMB = DEFAULT_MAX_CACHE_SIZE_MB) {
    try {
      const maxBytes = maxSizeMB * 1024 * 1024
      const entries = await getAllCacheEntries()
      
      let totalSize = entries.reduce((sum, entry) => sum + (entry.data?.length || 0), 0)
      
      if (totalSize <= maxBytes) {
        return // Under limit, nothing to do
      }
      
      console.log(`Cache size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds limit ${maxSizeMB}MB, evicting old entries...`)
      
      // Sort by timestamp (oldest first) for LRU eviction
      entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      
      const db = await initCache()
      const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(CACHE_STORE_NAME)
      
      let evictedCount = 0
      let evictedBytes = 0
      
      for (const entry of entries) {
        if (totalSize <= maxBytes) break
        
        const entrySize = entry.data?.length || 0
        store.delete(entry.key)
        totalSize -= entrySize
        evictedBytes += entrySize
        evictedCount++
      }
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve
        transaction.onerror = () => reject(transaction.error)
      })
      
      console.log(`Evicted ${evictedCount} cache entries (${(evictedBytes / 1024 / 1024).toFixed(2)}MB), new size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`)
      
    } catch (err) {
      console.warn('Failed to enforce cache limit:', err)
    }
  }

  function getCacheKey(gameInfo) {
    if (!gameInfo) return null
    // Use cartridge_id or game_id, and sha256 for cache key
    const id = gameInfo.cartridgeId || gameInfo.game_id || 'unknown'
    const hash = gameInfo.sha256 || 'unknown'
    return `${id}_${hash}`
  }

  async function loadFromCache(gameInfo) {
    try {
      const db = await initCache()
      const key = getCacheKey(gameInfo)
      if (!key) return null
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readonly')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.get(key)
        
        request.onsuccess = () => {
          if (request.result && request.result.data) {
            // Convert Array back to Uint8Array
            const uint8Array = new Uint8Array(request.result.data)
            const filename = gameInfo.filename || 'game'
            console.log(`Loaded ${filename} from cache (${uint8Array.length} bytes)`)
            resolve(uint8Array)
          } else {
            resolve(null)
          }
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Cache load error:', err)
      return null
    }
  }

  async function saveToCache(gameInfo, fileData) {
    try {
      const db = await initCache()
      const key = getCacheKey(gameInfo)
      if (!key || !fileData) return
      
      const dataArray = Array.from(fileData)
      const gameId = gameInfo.cartridgeId || gameInfo.game_id || 0
      const filename = gameInfo.filename || 'game'
      
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.put({
          key: key,
          data: dataArray,
          manifestName: filename,
          gameId: gameId,
          timestamp: Date.now()
        })
        
        request.onsuccess = () => {
          console.log(`Saved ${filename} to cache (${fileData.length} bytes)`)
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
      
      // Enforce cache size limit after saving (async, don't block)
      enforceCacheLimit().catch(err => console.warn('Cache limit enforcement failed:', err))
      
    } catch (err) {
      console.warn('Cache save error:', err)
    }
  }

  async function clearCache(gameInfo) {
    try {
      const db = await initCache()
      const key = getCacheKey(gameInfo)
      if (!key) return
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.delete(key)
        
        request.onsuccess = () => {
          const filename = gameInfo.filename || 'game'
          console.log(`Cleared cache for ${filename}`)
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Cache clear error:', err)
    }
  }

  async function clearAllCache() {
    try {
      const db = await initCache()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.clear()
        
        request.onsuccess = () => {
          console.log('Cleared all cache')
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Cache clear all error:', err)
    }
  }

  return {
    loadFromCache,
    saveToCache,
    clearCache,
    clearAllCache,
    getCacheSize,
    enforceCacheLimit
  }
}

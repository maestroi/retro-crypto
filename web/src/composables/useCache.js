/**
 * Cache composable for storing downloaded game files in IndexedDB
 */

const CACHE_DB_NAME = 'retro-crypto-cache'
const CACHE_DB_VERSION = 1
const CACHE_STORE_NAME = 'game-files'
const DEFAULT_MAX_CACHE_SIZE_MB = 200

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

  async function getCacheSize() {
    const entries = await getAllCacheEntries()
    return entries.reduce((sum, entry) => sum + (entry.data?.length || 0), 0)
  }

  async function enforceCacheLimit(maxSizeMB = DEFAULT_MAX_CACHE_SIZE_MB) {
    try {
      const maxBytes = maxSizeMB * 1024 * 1024
      const entries = await getAllCacheEntries()
      
      let totalSize = entries.reduce((sum, entry) => sum + (entry.data?.length || 0), 0)
      
      if (totalSize <= maxBytes) return
      
      console.log(`Cache size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds limit ${maxSizeMB}MB, evicting...`)
      
      entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      
      const db = await initCache()
      const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(CACHE_STORE_NAME)
      
      for (const entry of entries) {
        if (totalSize <= maxBytes) break
        const entrySize = entry.data?.length || 0
        store.delete(entry.key)
        totalSize -= entrySize
      }
      
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve
        transaction.onerror = () => reject(transaction.error)
      })
      
    } catch (err) {
      console.warn('Failed to enforce cache limit:', err)
    }
  }

  function getCacheKey(gameInfo) {
    if (!gameInfo) return null
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
            const uint8Array = new Uint8Array(request.result.data)
            console.log(`Loaded from cache (${uint8Array.length} bytes)`)
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
      
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CACHE_STORE_NAME)
        const request = store.put({
          key: key,
          data: dataArray,
          gameId: gameId,
          timestamp: Date.now()
        })
        
        request.onsuccess = () => {
          console.log(`Saved to cache (${fileData.length} bytes)`)
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
      
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
          console.log('Cache cleared')
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
          console.log('All cache cleared')
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


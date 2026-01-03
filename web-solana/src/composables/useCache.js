const CACHE_DB_NAME = 'solana-retro-cache'
const CACHE_DB_VERSION = 2 // Bumped for chunk store
const CACHE_STORE_NAME = 'game-files'
const CHUNK_STORE_NAME = 'chunks'

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
        // Full file cache store
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' })
        }
        // Chunk-level cache store (for partial downloads / resume support)
        if (!db.objectStoreNames.contains(CHUNK_STORE_NAME)) {
          const chunkStore = db.createObjectStore(CHUNK_STORE_NAME, { keyPath: 'key' })
          // Index for querying all chunks of a cartridge
          chunkStore.createIndex('cartridgeId', 'cartridgeId', { unique: false })
        }
      }
    })
  }

  function getCacheKey(gameInfo) {
    if (!gameInfo) return null
    // Use cartridge_id or game_id, and sha256 for cache key
    const id = gameInfo.cartridgeId || gameInfo.game_id || 'unknown'
    const hash = gameInfo.sha256 || 'unknown'
    return `${id}_${hash}`
  }

  function getChunkKey(cartridgeId, chunkIndex) {
    return `${cartridgeId}_chunk_${chunkIndex}`
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
      
      return new Promise((resolve, reject) => {
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
    } catch (err) {
      console.warn('Cache save error:', err)
    }
  }

  /**
   * Get a single cached chunk
   */
  async function getChunk(cartridgeId, chunkIndex) {
    try {
      const db = await initCache()
      const key = getChunkKey(cartridgeId, chunkIndex)
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHUNK_STORE_NAME], 'readonly')
        const store = transaction.objectStore(CHUNK_STORE_NAME)
        const request = store.get(key)
        
        request.onsuccess = () => {
          if (request.result && request.result.data) {
            resolve(new Uint8Array(request.result.data))
          } else {
            resolve(null)
          }
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Chunk cache load error:', err)
      return null
    }
  }

  /**
   * Save a single chunk to cache
   */
  async function saveChunk(cartridgeId, chunkIndex, chunkData) {
    try {
      const db = await initCache()
      const key = getChunkKey(cartridgeId, chunkIndex)
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHUNK_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CHUNK_STORE_NAME)
        const request = store.put({
          key: key,
          cartridgeId: cartridgeId,
          chunkIndex: chunkIndex,
          data: Array.from(chunkData),
          timestamp: Date.now()
        })
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Chunk cache save error:', err)
    }
  }

  /**
   * Get all cached chunks for a cartridge
   * Returns a Map<chunkIndex, Uint8Array>
   */
  async function getCachedChunks(cartridgeId, totalChunks) {
    try {
      const db = await initCache()
      const cachedChunks = new Map()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHUNK_STORE_NAME], 'readonly')
        const store = transaction.objectStore(CHUNK_STORE_NAME)
        const index = store.index('cartridgeId')
        const request = index.getAll(cartridgeId)
        
        request.onsuccess = () => {
          if (request.result) {
            for (const item of request.result) {
              if (item.chunkIndex < totalChunks) {
                cachedChunks.set(item.chunkIndex, new Uint8Array(item.data))
              }
            }
          }
          console.log(`Found ${cachedChunks.size}/${totalChunks} cached chunks for ${cartridgeId.substring(0, 8)}...`)
          resolve(cachedChunks)
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Cached chunks load error:', err)
      return new Map()
    }
  }

  /**
   * Save multiple chunks at once (batch operation)
   */
  async function saveChunks(cartridgeId, chunks) {
    try {
      const db = await initCache()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHUNK_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CHUNK_STORE_NAME)
        const timestamp = Date.now()
        
        for (const { index, data } of chunks) {
          const key = getChunkKey(cartridgeId, index)
          store.put({
            key: key,
            cartridgeId: cartridgeId,
            chunkIndex: index,
            data: Array.from(data),
            timestamp: timestamp
          })
        }
        
        transaction.oncomplete = () => {
          console.log(`Saved ${chunks.length} chunks to cache for ${cartridgeId.substring(0, 8)}...`)
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (err) {
      console.warn('Batch chunk cache save error:', err)
    }
  }

  /**
   * Clear all chunks for a cartridge
   */
  async function clearChunks(cartridgeId) {
    try {
      const db = await initCache()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHUNK_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(CHUNK_STORE_NAME)
        const index = store.index('cartridgeId')
        const request = index.getAllKeys(cartridgeId)
        
        request.onsuccess = () => {
          if (request.result) {
            for (const key of request.result) {
              store.delete(key)
            }
          }
          console.log(`Cleared chunks for ${cartridgeId.substring(0, 8)}...`)
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Clear chunks error:', err)
    }
  }

  async function clearCache(gameInfo) {
    try {
      const db = await initCache()
      const key = getCacheKey(gameInfo)
      if (!key) return
      
      // Also clear chunks if cartridgeId is available
      if (gameInfo.cartridgeId) {
        await clearChunks(gameInfo.cartridgeId)
      }
      
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
        const transaction = db.transaction([CACHE_STORE_NAME, CHUNK_STORE_NAME], 'readwrite')
        
        // Clear both stores
        transaction.objectStore(CACHE_STORE_NAME).clear()
        transaction.objectStore(CHUNK_STORE_NAME).clear()
        
        transaction.oncomplete = () => {
          console.log('Cleared all cache (files and chunks)')
          resolve()
        }
        
        transaction.onerror = () => reject(transaction.error)
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
    // Chunk-level caching functions
    getChunk,
    saveChunk,
    getCachedChunks,
    saveChunks,
    clearChunks
  }
}

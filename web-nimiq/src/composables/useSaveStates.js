import { ref } from 'vue'

const SAVE_DB_NAME = 'nimiq-doom-saves'
const SAVE_DB_VERSION = 1
const SAVE_STORE_NAME = 'save-states'
const MAX_SAVES_PER_GAME = 10

let saveDB = null

/**
 * Save States composable
 * Manages game save states in IndexedDB
 */
export function useSaveStates() {
  const saves = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Initialize IndexedDB
   */
  async function initDB() {
    if (saveDB) return saveDB
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        saveDB = request.result
        resolve(saveDB)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        if (!db.objectStoreNames.contains(SAVE_STORE_NAME)) {
          const store = db.createObjectStore(SAVE_STORE_NAME, { keyPath: 'id', autoIncrement: true })
          store.createIndex('gameKey', 'gameKey', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  /**
   * Generate a unique key for a game
   */
  function getGameKey(appId, cartridgeId) {
    return `${appId}_${cartridgeId}`
  }

  /**
   * Save a game state
   * @param {Object} options - Save options
   * @param {number} options.appId - App ID
   * @param {number} options.cartridgeId - Cartridge ID
   * @param {string} options.title - Game title
   * @param {string} options.platform - Platform (DOS, GB, etc.)
   * @param {ArrayBuffer|Uint8Array} options.state - Save state data
   * @param {string} [options.name] - Custom save name
   * @param {string} [options.screenshot] - Base64 screenshot
   */
  async function saveState({ appId, cartridgeId, title, platform, state, name, screenshot }) {
    try {
      loading.value = true
      error.value = null
      
      const db = await initDB()
      const gameKey = getGameKey(appId, cartridgeId)
      
      // Convert state to array for storage
      const stateArray = state instanceof Uint8Array 
        ? Array.from(state) 
        : Array.from(new Uint8Array(state))
      
      const saveEntry = {
        gameKey,
        appId,
        cartridgeId,
        title,
        platform,
        name: name || `Save ${new Date().toLocaleString()}`,
        state: stateArray,
        screenshot: screenshot || null,
        timestamp: Date.now()
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SAVE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(SAVE_STORE_NAME)
        const request = store.add(saveEntry)
        
        request.onsuccess = async () => {
          // Clean up old saves if over limit
          await cleanupOldSaves(gameKey)
          await loadSaves(appId, cartridgeId)
          resolve(request.result)
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Load a save state
   * @param {number} saveId - Save ID
   * @returns {Promise<Object>} - Save state object
   */
  async function loadState(saveId) {
    try {
      loading.value = true
      error.value = null
      
      const db = await initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SAVE_STORE_NAME], 'readonly')
        const store = transaction.objectStore(SAVE_STORE_NAME)
        const request = store.get(saveId)
        
        request.onsuccess = () => {
          if (request.result) {
            // Convert state array back to Uint8Array
            const state = new Uint8Array(request.result.state)
            resolve({ ...request.result, state })
          } else {
            resolve(null)
          }
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Load all saves for a game
   */
  async function loadSaves(appId, cartridgeId) {
    try {
      const db = await initDB()
      const gameKey = getGameKey(appId, cartridgeId)
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SAVE_STORE_NAME], 'readonly')
        const store = transaction.objectStore(SAVE_STORE_NAME)
        const index = store.index('gameKey')
        const request = index.getAll(gameKey)
        
        request.onsuccess = () => {
          // Sort by timestamp (newest first)
          saves.value = (request.result || []).sort((a, b) => b.timestamp - a.timestamp)
          resolve(saves.value)
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      error.value = err.message
      saves.value = []
      return []
    }
  }

  /**
   * Delete a save state
   */
  async function deleteSave(saveId) {
    try {
      loading.value = true
      const db = await initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SAVE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(SAVE_STORE_NAME)
        const request = store.delete(saveId)
        
        request.onsuccess = () => {
          saves.value = saves.value.filter(s => s.id !== saveId)
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Rename a save state
   */
  async function renameSave(saveId, newName) {
    try {
      loading.value = true
      const db = await initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SAVE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(SAVE_STORE_NAME)
        const getRequest = store.get(saveId)
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const updated = { ...getRequest.result, name: newName }
            const putRequest = store.put(updated)
            
            putRequest.onsuccess = () => {
              const save = saves.value.find(s => s.id === saveId)
              if (save) save.name = newName
              resolve()
            }
            
            putRequest.onerror = () => reject(putRequest.error)
          } else {
            reject(new Error('Save not found'))
          }
        }
        
        getRequest.onerror = () => reject(getRequest.error)
      })
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clean up old saves if over limit
   */
  async function cleanupOldSaves(gameKey) {
    try {
      const db = await initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SAVE_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(SAVE_STORE_NAME)
        const index = store.index('gameKey')
        const request = index.getAll(gameKey)
        
        request.onsuccess = () => {
          const gameSaves = request.result || []
          
          if (gameSaves.length > MAX_SAVES_PER_GAME) {
            // Sort by timestamp and remove oldest
            gameSaves.sort((a, b) => b.timestamp - a.timestamp)
            const toDelete = gameSaves.slice(MAX_SAVES_PER_GAME)
            
            for (const save of toDelete) {
              store.delete(save.id)
            }
          }
          
          resolve()
        }
        
        request.onerror = () => reject(request.error)
      })
    } catch (err) {
      console.warn('Error cleaning up old saves:', err)
    }
  }

  /**
   * Export a save state as downloadable file
   */
  async function exportSave(saveId) {
    const save = await loadState(saveId)
    if (!save) throw new Error('Save not found')
    
    const exportData = {
      version: 1,
      appId: save.appId,
      cartridgeId: save.cartridgeId,
      title: save.title,
      platform: save.platform,
      name: save.name,
      timestamp: save.timestamp,
      state: Array.from(save.state)
    }
    
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${save.title.replace(/[^a-z0-9]/gi, '_')}_${save.name.replace(/[^a-z0-9]/gi, '_')}.save`
    a.click()
    
    URL.revokeObjectURL(url)
  }

  /**
   * Import a save state from file
   */
  async function importSave(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const exportData = JSON.parse(e.target.result)
          
          if (exportData.version !== 1) {
            throw new Error('Unsupported save file version')
          }
          
          const state = new Uint8Array(exportData.state)
          
          const saveId = await saveState({
            appId: exportData.appId,
            cartridgeId: exportData.cartridgeId,
            title: exportData.title,
            platform: exportData.platform,
            state,
            name: `${exportData.name} (imported)`
          })
          
          resolve(saveId)
        } catch (err) {
          reject(err)
        }
      }
      
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return {
    saves,
    loading,
    error,
    saveState,
    loadState,
    loadSaves,
    deleteSave,
    renameSave,
    exportSave,
    importSave,
    formatTimestamp
  }
}


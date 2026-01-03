/**
 * Universal Protocol Composable
 * 
 * Provides a unified interface for interacting with any supported blockchain protocol.
 * Manages protocol selection, driver creation, catalog loading, and cartridge downloading.
 */

import { ref, computed, watch, shallowRef } from 'vue'
import { createDriver, getProtocolConfig, getAllProtocols } from '../drivers/index.js'
import { useCache } from './useCache.js'

/**
 * Create a universal protocol composable
 * @returns {Object} Protocol state and methods
 */
export function useProtocol() {
  // Protocol selection
  const selectedProtocolId = ref('nimiq')
  const selectedRpcUrl = ref('')
  const customRpcUrl = ref('')
  const selectedCatalogName = ref('')
  const customCatalogAddress = ref('')
  
  // Driver instance (shallowRef to avoid deep reactivity)
  const driver = shallowRef(null)
  
  // Config for current protocol
  const protocolConfig = computed(() => getProtocolConfig(selectedProtocolId.value))
  
  // Available protocols
  const protocols = computed(() => getAllProtocols())
  
  // Get effective RPC URL
  const effectiveRpcUrl = computed(() => {
    if (selectedRpcUrl.value === 'custom') {
      return customRpcUrl.value
    }
    return selectedRpcUrl.value || protocolConfig.value?.defaultRpc || ''
  })
  
  // Get effective catalog address
  const effectiveCatalogAddress = computed(() => {
    if (selectedCatalogName.value === 'Custom...') {
      return customCatalogAddress.value
    }
    const catalog = protocolConfig.value?.catalogs?.find(c => c.name === selectedCatalogName.value)
    return catalog?.address || ''
  })
  
  // Publisher address for current protocol
  const publisherAddress = computed(() => protocolConfig.value?.publisherAddress || '')
  
  // Catalog state
  const catalogLoading = ref(false)
  const catalogError = ref(null)
  const games = ref([])
  
  // Cartridge state
  const cartridgeLoading = ref(false)
  const cartridgeError = ref(null)
  const cartHeader = ref(null)
  const fileData = ref(null)
  const verified = ref(false)
  const progress = ref({
    chunksFound: 0,
    expectedChunks: 0,
    bytes: 0,
    rate: 0,
    phase: 'idle',
    statusMessage: ''
  })
  
  // Developer mode
  const developerMode = ref(false)
  const showRetiredGames = ref(false)
  
  // Visible catalogs (hide devOnly unless in developer mode)
  const visibleCatalogs = computed(() => {
    const catalogs = protocolConfig.value?.catalogs || []
    if (developerMode.value) return catalogs
    return catalogs.filter(c => !c.devOnly)
  })
  
  // Cache
  const cache = useCache()
  
  // Combined loading/error states
  const loading = computed(() => catalogLoading.value || cartridgeLoading.value)
  const error = computed(() => catalogError.value || cartridgeError.value)
  
  // Progress percent
  const progressPercent = computed(() => {
    if (progress.value.expectedChunks === 0) return 0
    return Math.min(100, Math.max(0, (progress.value.chunksFound / progress.value.expectedChunks) * 100))
  })
  
  /**
   * Initialize driver with current settings
   */
  function initDriver() {
    const rpcUrl = effectiveRpcUrl.value
    if (!rpcUrl) {
      console.warn('No RPC URL configured')
      return
    }
    
    driver.value = createDriver(selectedProtocolId.value, rpcUrl)
    console.log(`Initialized ${selectedProtocolId.value} driver with RPC: ${rpcUrl}`)
  }
  
  /**
   * Change protocol
   */
  function setProtocol(protocolId) {
    selectedProtocolId.value = protocolId
    const config = getProtocolConfig(protocolId)
    selectedRpcUrl.value = config?.defaultRpc || ''
    selectedCatalogName.value = config?.defaultCatalog || ''
    customRpcUrl.value = ''
    customCatalogAddress.value = ''
    
    // Reset state
    resetState()
    initDriver()
  }
  
  /**
   * Change RPC endpoint
   */
  function setRpcEndpoint(url) {
    selectedRpcUrl.value = url
    if (url !== 'custom') {
      customRpcUrl.value = ''
      initDriver()
    }
  }
  
  /**
   * Change custom RPC URL
   */
  function setCustomRpcUrl(url) {
    customRpcUrl.value = url
    if (url) initDriver()
  }
  
  /**
   * Change catalog
   */
  function setCatalog(catalogName) {
    selectedCatalogName.value = catalogName
    if (catalogName !== 'Custom...') {
      customCatalogAddress.value = ''
    }
    resetGameState()
  }
  
  /**
   * Change custom catalog address
   */
  function setCustomCatalogAddress(address) {
    customCatalogAddress.value = address
    resetGameState()
  }
  
  /**
   * Reset all state
   */
  function resetState() {
    games.value = []
    catalogError.value = null
    resetGameState()
  }
  
  /**
   * Reset game/cartridge state
   */
  function resetGameState() {
    cartHeader.value = null
    fileData.value = null
    verified.value = false
    cartridgeError.value = null
    progress.value = {
      chunksFound: 0,
      expectedChunks: 0,
      bytes: 0,
      rate: 0,
      phase: 'idle',
      statusMessage: ''
    }
  }
  
  /**
   * Load catalog from blockchain
   */
  async function loadCatalog() {
    if (!driver.value) {
      initDriver()
      if (!driver.value) {
        catalogError.value = 'Driver not initialized'
        return
      }
    }
    
    const catalogAddress = effectiveCatalogAddress.value
    if (!catalogAddress) {
      catalogError.value = 'Catalog address not configured'
      return
    }
    
    catalogLoading.value = true
    catalogError.value = null
    games.value = []
    
    try {
      games.value = await driver.value.loadCatalog(
        catalogAddress,
        publisherAddress.value,
        showRetiredGames
      )
      console.log(`Loaded ${games.value.length} games from catalog`)
    } catch (err) {
      catalogError.value = err.message || 'Failed to load catalog'
      console.error('Catalog loading error:', err)
    } finally {
      catalogLoading.value = false
    }
  }
  
  /**
   * Load cartridge info (header/manifest only)
   */
  async function loadCartridgeInfo(cartridgeAddress) {
    if (!driver.value) {
      cartridgeError.value = 'Driver not initialized'
      return null
    }
    
    if (!cartridgeAddress) {
      cartridgeError.value = 'Cartridge address not provided'
      return null
    }
    
    try {
      const header = await driver.value.loadCartridgeInfo(cartridgeAddress)
      if (header) {
        cartHeader.value = header
        
        // Check cache
        const cacheKey = {
          cartridgeId: header.cartridgeId,
          sha256: header.sha256
        }
        
        console.log('Checking cache for:', cacheKey)
        const cachedData = await cache.loadFromCache(cacheKey)
        if (cachedData) {
          console.log('Found cached data, verifying SHA256...')
          // Verify cached data
          const hashBuffer = await crypto.subtle.digest('SHA-256', cachedData)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          
          if (hashHex.toLowerCase() === header.sha256.toLowerCase()) {
            console.log('✓ Cache hit! Loaded verified data from cache')
            fileData.value = cachedData
            verified.value = true
            progress.value = {
              chunksFound: header.numChunks || Math.ceil(header.totalSize / header.chunkSize),
              expectedChunks: header.numChunks || Math.ceil(header.totalSize / header.chunkSize),
              bytes: header.totalSize,
              rate: 0,
              phase: 'idle',
              statusMessage: ''
            }
          } else {
            console.log('✗ Cache data corrupted (SHA256 mismatch), clearing...')
            await cache.clearCache(cacheKey)
          }
        } else {
          console.log('Cache miss - will need to download')
        }
      }
      return header
    } catch (err) {
      cartridgeError.value = err.message || 'Failed to load cartridge info'
      console.error('Cartridge info error:', err)
      return null
    }
  }
  
  /**
   * Load full cartridge (download and verify)
   */
  async function loadCartridge(cartridgeAddress) {
    if (!driver.value) {
      cartridgeError.value = 'Driver not initialized'
      return
    }
    
    if (!cartridgeAddress) {
      cartridgeError.value = 'Cartridge address not provided'
      return
    }
    
    // If already loaded from cache
    if (fileData.value && verified.value && cartHeader.value) {
      console.log('Cartridge already loaded from cache')
      return
    }
    
    cartridgeLoading.value = true
    cartridgeError.value = null
    
    try {
      const result = await driver.value.loadCartridge(
        cartridgeAddress,
        publisherAddress.value,
        (prog) => {
          progress.value = { ...prog }
        }
      )
      
      fileData.value = result.fileData
      verified.value = result.verified
      if (result.cartHeader) {
        cartHeader.value = result.cartHeader
      }
      
      // Save to cache
      if (result.verified && cartHeader.value) {
        const cacheKey = {
          cartridgeId: cartHeader.value.cartridgeId,
          sha256: cartHeader.value.sha256
        }
        await cache.saveToCache(cacheKey, result.fileData)
      }
      
      progress.value.phase = 'idle'
      progress.value.statusMessage = ''
      
    } catch (err) {
      cartridgeError.value = err.message || 'Failed to load cartridge'
      console.error('Cartridge loading error:', err)
    } finally {
      cartridgeLoading.value = false
    }
  }
  
  /**
   * Clear cache for current cartridge
   */
  async function clearCartridgeCache() {
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
    
    console.log('Cache cleared')
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
  
  // Initialize on mount
  function initialize() {
    const config = getProtocolConfig(selectedProtocolId.value)
    if (!selectedRpcUrl.value) {
      selectedRpcUrl.value = config?.defaultRpc || ''
    }
    if (!selectedCatalogName.value) {
      selectedCatalogName.value = config?.defaultCatalog || ''
    }
    initDriver()
  }
  
  return {
    // Protocol state
    selectedProtocolId,
    selectedRpcUrl,
    customRpcUrl,
    selectedCatalogName,
    customCatalogAddress,
    protocolConfig,
    protocols,
    effectiveRpcUrl,
    effectiveCatalogAddress,
    catalogAddress: effectiveCatalogAddress,
    publisherAddress,
    visibleCatalogs,
    
    // Catalog state
    catalogLoading,
    catalogError,
    games,
    
    // Cartridge state
    cartridgeLoading,
    cartridgeError,
    cartHeader,
    fileData,
    verified,
    progress,
    progressPercent,
    
    // Developer mode
    developerMode,
    showRetiredGames,
    
    // Combined states
    loading,
    error,
    
    // Methods
    setProtocol,
    setRpcEndpoint,
    setCustomRpcUrl,
    setCatalog,
    setCustomCatalogAddress,
    loadCatalog,
    loadCartridgeInfo,
    loadCartridge,
    clearCartridgeCache,
    extractRunJson,
    resetState,
    resetGameState,
    initialize
  }
}


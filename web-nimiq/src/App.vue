<template>
  <div class="min-h-screen bg-gray-900 text-gray-100">
    <!-- Shortcut Toast Notification -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div 
        v-if="shortcutToast"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg text-sm text-white font-medium"
      >
        {{ shortcutToast }}
      </div>
    </Transition>
    
    <!-- Header -->
    <Header
      :selected-rpc-endpoint="selectedRpcEndpoint"
      :custom-rpc-endpoint="customRpcEndpoint"
      :rpc-endpoints="rpcEndpoints"
      :games="catalogGames"
      :selected-game="selectedGame"
      :selected-version="selectedVersion"
      :loading="catalogLoading || loading"
      :catalogs="visibleCatalogs"
      :selected-catalog-name="selectedCatalogName"
      :catalog-address="catalogAddress"
      :custom-catalog-address="customCatalogAddress"
      :publisher-address="publisherAddress"
      @update:rpc-endpoint="onRpcEndpointChange"
      @update:custom-rpc="onCustomRpcEndpointChange"
      @update:catalog="onCatalogChange"
      @update:custom-catalog="onCustomCatalogChange"
      @update:game="onGameChange"
      @update:version="onVersionChange"
      @refresh-catalog="loadCatalog"
      @show-help="showWelcome"
    />

    <!-- Main Content -->
    <div class="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Developer Mode Panel -->
      <div v-if="developerMode" class="mb-6 rounded-md bg-purple-900/30 border border-purple-700 p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-purple-200">🧪 Developer Mode</h3>
          <button
            @click="developerMode = false"
            class="text-purple-400 hover:text-purple-300"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-purple-200 mb-2">
              Test Local Game File (ZIP)
            </label>
            <div class="flex gap-2">
              <input
                type="file"
                ref="localFileInput"
                @change="handleLocalFileUpload"
                accept=".zip"
                class="hidden"
                id="local-file-input"
              />
              <label
                for="local-file-input"
                class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-purple-600 text-sm font-medium rounded-md text-purple-200 bg-purple-800/50 hover:bg-purple-800 cursor-pointer"
              >
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {{ localFileName || 'Choose ZIP file...' }}
              </label>
              <button
                v-if="localFileData"
                @click="runLocalGame"
                :disabled="loading || gameReady"
                class="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run Local Game
              </button>
            </div>
            <p v-if="localFileName" class="mt-2 text-xs text-purple-300">
              Loaded: {{ localFileName }} ({{ formatBytes(localFileData?.length || 0) }})
            </p>
          </div>
           <div>
             <label class="flex items-center gap-2">
               <input
                 type="checkbox"
                 v-model="showRetiredGames"
                 @change="loadCatalog"
                 class="rounded border-purple-600 bg-purple-800/50 text-purple-600 focus:ring-purple-500"
               />
               <span class="text-sm font-medium text-purple-200">Show Retired Games</span>
             </label>
             <p class="mt-1 text-xs text-purple-300">
               Display games that have been marked as retired in the catalog
             </p>
           </div>
          <div class="pt-2 border-t border-purple-700/50">
            <p class="text-xs text-purple-300">
              💡 This mode allows you to test games locally before uploading to the blockchain. 
              Upload a ZIP file containing your DOS game files and run it directly.
            </p>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="mb-6 rounded-md bg-red-900/50 border border-red-700 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-200">Error</h3>
            <div class="mt-2 text-sm text-red-300">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Recently Played - Compact horizontal bar -->
      <RecentlyPlayed 
        v-if="recentGames.length > 0 && !catalogLoading"
        :recent-games="recentGames"
        @select="selectRecentGame"
        @clear="clearRecentGames"
        class="mb-4"
      />
      
      <!-- Main Content: Game Selector + Emulator side by side -->
      <div class="space-y-6 mb-6">
        <!-- Top Row: Game Selector + Emulator -->
        <div class="grid grid-cols-1 lg:grid-cols-[0.6fr_1.4fr] gap-6">
          <!-- Game Selector Card (with download/sync) -->
          <GameSelector
            :games="catalogGames"
            :selected-game="selectedGame"
            :selected-version="selectedVersion"
            :selected-platform="selectedPlatform"
            :cart-header="cartHeader"
            :run-json="runJson"
            :sync-progress="cartridgeProgress"
            :verified="verified"
            :file-data="fileData"
            :loading="loading"
            :catalog-loading="catalogLoading"
            :error="error"
            :progress-percent="cartridgeProgressPercent"
            @update:platform="onPlatformChange"
            @update:game="onGameChange"
            @update:version="onVersionChange"
            @load-cartridge="loadCartridge"
            @clear-cache="clearCartridgeCache"
          />

          <!-- Emulator Container -->
          <EmulatorContainer
            :platform="currentPlatform"
            :verified="verified"
            :loading="loading"
            :game-ready="gameReady"
            @run-game="runGame"
            @stop-game="stopGame"
            @download-file="downloadFile"
            ref="emulatorContainerRef"
            id="emulator-container"
            class="emulator-container"
          />
        </div>
      </div>
    </div>
    
    <!-- Welcome Modal -->
    <WelcomeModal ref="welcomeModalRef" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatBytes } from './utils.js'
import { NimiqRPC } from './nimiq-rpc.js'
import Header from './components/Header.vue'
import EmulatorContainer from './components/EmulatorContainer.vue'
import GameSelector from './components/GameSelector.vue'
import RecentlyPlayed from './components/RecentlyPlayed.vue'
import WelcomeModal from './components/WelcomeModal.vue'
import { useCatalog } from './composables/useCatalog.js'
import { useRecentlyPlayed } from './composables/useRecentlyPlayed.js'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js'
import { useCartridge } from './composables/useCartridge.js'
import { useDosEmulator } from './composables/useDosEmulator.js'
import { useGbEmulator } from './composables/useGbEmulator.js'
import { useNesEmulator } from './composables/useNesEmulator.js'

// RPC Configuration
const rpcEndpoints = ref([
  { name: 'NimiqScan Mainnet', url: 'https://rpc-mainnet.nimiqscan.com' },
  { name: 'Custom...', url: 'custom' }
])

const selectedRpcEndpoint = ref('https://rpc-mainnet.nimiqscan.com')
const customRpcEndpoint = ref('')
const rpcClient = ref(new NimiqRPC(selectedRpcEndpoint.value))

// Configuration - Multiple catalogs
const catalogs = ref([
  { name: 'Test', address: 'NQ32 0VD4 26TR 1394 KXBJ 862C NFKG 61M5 GFJ0', devOnly: true },
  { name: 'Main', address: 'NQ15 NXMP 11A0 TMKP G1Q8 4ABD U16C XD6Q D948' },
  { name: 'Custom...', address: 'custom' }
])
const selectedCatalogName = ref('Main') // Default to Main (public catalog)
const customCatalogAddress = ref('')

// Developer Mode
const developerMode = ref(false)
const showRetiredGames = ref(false)

// Visible catalogs (hide Test catalog unless in developer mode)
const visibleCatalogs = computed(() => {
  if (developerMode.value) {
    return catalogs.value
  }
  return catalogs.value.filter(c => !c.devOnly)
})

// Switch away from Test catalog if developer mode is disabled
watch(developerMode, (newVal) => {
  if (!newVal && selectedCatalogName.value === 'Test') {
    selectedCatalogName.value = 'Main'
    console.log('Switched from Test to Main catalog (developer mode disabled)')
  }
})

const catalogAddress = computed(() => {
  if (selectedCatalogName.value === 'Custom...') {
    return customCatalogAddress.value || null
  }
  const catalog = catalogs.value.find(c => c.name === selectedCatalogName.value)
  return catalog ? catalog.address : catalogs.value.find(c => c.name === 'Main')?.address
})
const publisherAddress = ref('NQ89 4GDH 0J4U C2FY TU0Y TP1X J1H7 3HX3 PVSE') // Trusted publisher address

// Catalog and Cartridge
const selectedPlatform = ref(null)
const selectedGame = ref(null)
const selectedVersion = ref(null)

// Catalog composable
const catalog = useCatalog(rpcClient, catalogAddress, publisherAddress, showRetiredGames)
const { 
  loading: catalogLoading, 
  error: catalogError, 
  games: catalogGames, 
  loadCatalog 
} = catalog

// Cartridge composable
const cartridgeAddress = computed(() => {
  return selectedVersion.value?.cartridgeAddress || null
})
const cartridge = useCartridge(rpcClient, cartridgeAddress, publisherAddress)
const {
  loading: cartridgeLoading,
  error: cartridgeError,
  fileData,
  verified,
  cartHeader,
  progress: cartridgeProgress,
  progressPercent: cartridgeProgressPercent,
  loadCartridgeInfo,
  loadCartridge,
  extractRunJson,
  clearCache: clearCartridgeCache
} = cartridge

const runJson = ref(null)

// Auto-run setting
const autoRunAfterDownload = ref(true)

// Watch for cartridge loading completion to extract run.json and auto-run
watch([fileData, verified], async ([newFileData, newVerified]) => {
  if (newFileData && newVerified) {
    runJson.value = await extractRunJson()
    
    // Auto-run the game after successful download
    if (autoRunAfterDownload.value && !gameReady.value) {
      // Small delay to ensure UI is updated
      setTimeout(() => {
        runGame()
      }, 100)
    }
  } else {
    runJson.value = null
  }
})

// Emulator state (separate from catalog/cartridge loading)
const emulatorLoading = ref(false)
const emulatorError = ref(null)

// Combined loading and error states
const loading = computed(() => catalogLoading.value || cartridgeLoading.value || emulatorLoading.value)
const error = computed(() => catalogError.value || cartridgeError.value || emulatorError.value)

// Recently Played
const { recentGames, addRecentGame, clearRecentGames } = useRecentlyPlayed()

// Select a recently played game
async function selectRecentGame(recentGame) {
  // Stop any running emulator first
  if (gameReady.value) {
    await stopGame()
  }
  
  // Find the game in catalog
  const game = catalogGames.value?.find(g => g.appId === recentGame.appId)
  if (game) {
    selectedPlatform.value = game.platform
    await onGameChange(game)
    // onGameChange now auto-starts download
  }
}

// Keyboard shortcuts
const shortcutsEnabled = computed(() => gameReady.value)
const shortcutToast = ref(null)

function showShortcutToast(message) {
  shortcutToast.value = message
  setTimeout(() => {
    shortcutToast.value = null
  }, 1500)
}

const { shortcuts, toggleFullscreen, isPaused, isMuted, lastAction, isActive } = useKeyboardShortcuts({
  enabled: shortcutsEnabled,
  onFullscreen: (isFullscreen) => {
    console.log('[App] Fullscreen toggled:', isFullscreen)
  },
  onReset: async () => {
    // Stop and restart the game
    if (gameReady.value) {
      console.log('[App] Resetting game...')
      await stopGame()
      setTimeout(() => runGame(), 200)
    }
  },
  onPause: (paused) => {
    console.log('[App] Pause toggled:', paused)
    // Note: Pause requires emulator support - iframe emulators may not support this
  },
  onMute: (muted) => {
    console.log('[App] Mute toggled:', muted)
    // Note: Mute requires emulator support - iframe emulators may not support this
  }
})

// Watch lastAction from keyboard shortcuts to show toast
watch(lastAction, (action) => {
  if (action) {
    shortcutToast.value = action
  }
})

// Handle platform selection
async function onPlatformChange(platform) {
  // Stop any running emulator first
  if (gameReady.value) {
    await stopGame()
  }
  
  selectedPlatform.value = platform
  // Reset game selection when platform changes
  selectedGame.value = null
  selectedVersion.value = null
  fileData.value = null
  verified.value = false
  runJson.value = null
  
  // Auto-select first game if platform is selected
  if (platform && catalogGames.value && catalogGames.value.length > 0) {
    const filteredGames = catalogGames.value.filter(game => game.platform === platform)
    if (filteredGames.length > 0) {
      await onGameChange(filteredGames[0])
    }
  }
}

// Handle game selection
async function onGameChange(game) {
  // Stop any running emulator first
  if (gameReady.value) {
    await stopGame()
  }
  
  selectedGame.value = game
  if (game && game.versions.length > 0) {
    selectedVersion.value = game.versions[0] // Select latest version
  } else {
    selectedVersion.value = null
  }
  // Reset cartridge state
  fileData.value = null
  verified.value = false
  runJson.value = null
  
  // Auto-start download when game is selected
  if (game && selectedVersion.value) {
    // Small delay to ensure state is updated
    setTimeout(() => {
      loadCartridge()
    }, 50)
  }
}

// Handle catalog selection
function onCatalogChange(catalogName) {
  selectedCatalogName.value = catalogName
  // Reset platform, game selection and reload catalog
  selectedPlatform.value = null
  selectedGame.value = null
  selectedVersion.value = null
  fileData.value = null
  verified.value = false
  runJson.value = null
  // Reload catalog with new address (only if not custom or if custom address is set)
  if (catalogName !== 'Custom...' || customCatalogAddress.value) {
    loadCatalog()
  }
}

// Handle custom catalog address change
function onCustomCatalogChange(address) {
  customCatalogAddress.value = address
  // Reset game selection and reload catalog if address is set
  selectedGame.value = null
  selectedVersion.value = null
  fileData.value = null
  verified.value = false
  runJson.value = null
  if (address) {
    loadCatalog()
  }
}

// Handle version selection
async function onVersionChange(version) {
  // Stop any running emulator first
  if (gameReady.value) {
    await stopGame()
  }
  
  selectedVersion.value = version
  // Reset cartridge state
  fileData.value = null
  verified.value = false
  runJson.value = null
  
  // Auto-start download when version changes
  if (version) {
    setTimeout(() => {
      loadCartridge()
    }, 50)
  }
}

// Watch for catalog address changes to reload catalog
watch(catalogAddress, async (newAddress) => {
  if (newAddress) {
    // Reset platform, selection and reload catalog
    selectedPlatform.value = null
    selectedGame.value = null
    selectedVersion.value = null
    fileData.value = null
    verified.value = false
    runJson.value = null
    await loadCatalog()
  }
}, { immediate: false })

// Auto-select first platform when games are loaded
watch(catalogGames, (newGames) => {
  if (newGames && newGames.length > 0 && !selectedPlatform.value) {
    // Get unique platforms
    const platforms = [...new Set(newGames.map(g => g.platform).filter(Boolean))].sort()
    if (platforms.length > 0) {
      selectedPlatform.value = platforms[0]
      // Auto-select first game for that platform
      const filteredGames = newGames.filter(game => game.platform === platforms[0])
      if (filteredGames.length > 0) {
        onGameChange(filteredGames[0])
      }
    }
  }
}, { immediate: true })

// Watch for version changes to load cartridge info only (no download)
watch(selectedVersion, async (newVersion) => {
  if (!newVersion || !newVersion.cartridgeAddress) {
    fileData.value = null
    verified.value = false
    runJson.value = null
    cartHeader.value = null
    return
  }
  
  // Only load CART header info for display, don't download yet
  await loadCartridgeInfo()
}, { immediate: false })

// Emulator
const gameReady = ref(false)
const emulatorContainerRef = ref(null)
const welcomeModalRef = ref(null)

// Show welcome modal (can be triggered from help button)
function showWelcome() {
  welcomeModalRef.value?.show()
}

// Helper to convert platform code to string
function getPlatformName(platformCode) {
  if (typeof platformCode === 'string') return platformCode
  switch (platformCode) {
    case 0: return 'DOS'
    case 1: return 'GB'
    case 2: return 'GBC'
    default: return 'DOS'
  }
}

// Computed platform name for EmulatorContainer
const currentPlatform = computed(() => {
  // Priority: run.json platform > cart header platform > default
  if (runJson.value?.platform) {
    return runJson.value.platform
  }
  if (cartHeader.value?.platform !== undefined) {
    return getPlatformName(cartHeader.value.platform)
  }
  return 'DOS'
})

// Create a manifest-like object for DOS emulator compatibility
const manifestForEmulator = computed(() => {
  if (!cartHeader.value && !runJson.value && !fileData.value) return null
  
  return {
    filename: runJson.value?.filename || 'game.zip',
    game_id: cartHeader.value?.cartridgeId || 0,
    total_size: cartHeader.value?.totalSize || (fileData.value?.length || 0),
    chunk_size: cartHeader.value?.chunkSize || 51,
    network: 'mainnet',
    sender_address: publisherAddress.value || '',
    sha256: cartHeader.value?.sha256 || '',
    platform: currentPlatform.value,
    executable: runJson.value?.executable || null,
    title: runJson.value?.title || selectedGame.value?.title || null
  }
})

// Emulator composables (use emulatorLoading and emulatorError refs, not computed properties)
const dosEmulator = useDosEmulator(manifestForEmulator, fileData, verified, emulatorLoading, emulatorError, gameReady)
const gbEmulator = useGbEmulator(manifestForEmulator, fileData, verified, emulatorLoading, emulatorError, gameReady)
const nesEmulator = useNesEmulator(manifestForEmulator, fileData, verified, emulatorLoading, emulatorError, gameReady)

// Wrapper functions that get the container element and call the composable
async function runGame() {
  const emulatorComponent = emulatorContainerRef.value?.emulatorRef
  const containerElement = emulatorComponent?.gameContainer
  
  if (!containerElement) {
    error.value = 'Game container not found in emulator component.'
    return
  }
  
  // Route to appropriate emulator based on platform
  const platform = manifestForEmulator.value?.platform || 'DOS'
  if (platform === 'DOS') {
    await dosEmulator.runGame(containerElement)
  } else if (platform === 'GB' || platform === 'GBC') {
    await gbEmulator.runGame(containerElement)
  } else if (platform === 'NES') {
    await nesEmulator.runGame(containerElement)
  } else {
    error.value = `Emulator for platform "${platform}" not yet implemented`
  }
  
  // Add to recently played
  if (selectedGame.value && selectedVersion.value) {
    addRecentGame({
      appId: selectedGame.value.appId,
      title: selectedGame.value.title,
      platform: selectedGame.value.platform,
      cartridgeAddress: selectedVersion.value.cartridgeAddress,
      version: selectedVersion.value.semver?.string
    })
  }
}

async function stopGame() {
  const emulatorComponent = emulatorContainerRef.value?.emulatorRef
  const containerElement = emulatorComponent?.gameContainer
  
  // Route to appropriate emulator based on platform
  const platform = manifestForEmulator.value?.platform || 'DOS'
  if (platform === 'DOS') {
    await dosEmulator.stopGame(containerElement)
  } else if (platform === 'GB' || platform === 'GBC') {
    await gbEmulator.stopGame(containerElement)
  } else if (platform === 'NES') {
    await nesEmulator.stopGame(containerElement)
  }
}

// Developer mode
const localFileData = ref(null)
const localFileName = ref(null)

// RPC endpoint handlers
function onRpcEndpointChange(newEndpoint) {
  selectedRpcEndpoint.value = newEndpoint
  if (newEndpoint !== 'custom') {
    rpcClient.value = new NimiqRPC(newEndpoint)
  }
}

function onCustomRpcEndpointChange(newUrl) {
  customRpcEndpoint.value = newUrl
  if (newUrl) {
    selectedRpcEndpoint.value = newUrl
    rpcClient.value = new NimiqRPC(newUrl)
  }
}

// Download file helper
function downloadFile() {
  if (!fileData.value) return
  
  const blob = new Blob([fileData.value], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = runJson.value?.filename || 'game.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Wrapper functions that get the container element and call the composable


// Developer mode functions
const localFileInput = ref(null)

async function handleLocalFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  if (!file.name.toLowerCase().endsWith('.zip')) {
    error.value = 'Please select a ZIP file'
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    localFileData.value = new Uint8Array(arrayBuffer)
    localFileName.value = file.name
    console.log('Loaded local file:', file.name, 'Size:', localFileData.value.length)
  } catch (err) {
    error.value = `Failed to load file: ${err.message}`
    console.error('Error loading local file:', err)
  } finally {
    loading.value = false
  }
}

async function runLocalGame() {
  if (!localFileData.value) {
    error.value = 'No local file loaded'
    return
  }
  
  // Stop any currently running game
  if (gameReady.value) {
    stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // Reset state
  error.value = null
  loading.value = true
  
  try {
    // Create a temporary manifest-like object for local files
    const tempManifest = {
      filename: localFileName.value,
      game_id: 0,
      total_size: localFileData.value.length,
      chunk_size: 51,
      network: 'local',
      sender_address: 'LOCAL',
      sha256: '', // Will be computed if needed
      platform: 'DOS'
    }
    
    // Set fileData and verified to allow running
    fileData.value = localFileData.value
    verified.value = true
    cartHeader.value = {
      cartridgeId: 0,
      totalSize: localFileData.value.length,
      chunkSize: 51,
      sha256: '',
      platform: 0 // DOS
    }
    runJson.value = null
    
    // Now run the game using the existing runGame function
    await runGame()
  } catch (err) {
    error.value = `Failed to run local game: ${err.message}`
    console.error('Error running local game:', err)
  } finally {
    loading.value = false
  }
}

// Keyboard shortcut for developer mode (Ctrl+Shift+D)
function handleKeyDown(event) {
  if (event.ctrlKey && event.shiftKey && event.key === 'D') {
    event.preventDefault()
    developerMode.value = !developerMode.value
    console.log('Developer mode:', developerMode.value ? 'enabled' : 'disabled')
  }
}

onMounted(() => {
  // Add keyboard listener for developer mode
  window.addEventListener('keydown', handleKeyDown)
  
  // Auto-load catalog on mount if catalog address is configured
  if (catalogAddress.value) {
    loadCatalog()
  } else {
    console.warn('Catalog address not configured. Please set CATALOG_ADDRESS.')
  }
})

onUnmounted(() => {
  // Cleanup keyboard listener
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

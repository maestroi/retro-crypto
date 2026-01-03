<template>
  <div class="min-h-screen bg-gray-900 text-gray-100">
    <!-- Welcome Modal -->
    <WelcomeModal ref="welcomeModalRef" />
    
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
      @show-info="showWelcomeModal"
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

      <!-- Main Content: Game Selector + Emulator side by side, Sync below -->
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
            :auto-run-enabled="autoRunEnabled"
            @update:platform="onPlatformChange"
            @update:game="onGameChange"
            @update:version="onVersionChange"
            @load-cartridge="loadCartridge"
            @clear-cache="clearCartridgeCache"
            @update:auto-run="autoRunEnabled = $event"
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
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatBytes } from './utils.js'
import { SolanaRPC } from './solana-rpc.js'
import Header from './components/Header.vue'
import EmulatorContainer from './components/EmulatorContainer.vue'
import GameSelector from './components/GameSelector.vue'
import WelcomeModal from './components/WelcomeModal.vue'
import { useSolanaCatalog } from './composables/useSolanaCatalog.js'
import { useSolanaCartridge } from './composables/useSolanaCartridge.js'
import { useDosEmulator } from './composables/useDosEmulator.js'
import { useGbEmulator } from './composables/useGbEmulator.js'
import { useNesEmulator } from './composables/useNesEmulator.js'

// Solana RPC Configuration
// Support multiple RPC endpoints - primary for catalog, fallback for larger game downloads

// RPC Proxy endpoints
const RPC_PROXY_PROD = 'https://rpc-solana-retro.maestroi.cc' // Update this to your deployed domain
const RPC_PROXY_LOCAL = 'http://localhost:8899'

const rpcEndpoints = ref([
  { name: 'Solana Retro Proxy (Recommended)', url: RPC_PROXY_PROD },
  { name: 'Solana Local Proxy', url: RPC_PROXY_LOCAL },
  { name: 'Solana Testnet (Rate Limited)', url: 'https://api.testnet.solana.com' },
  { name: 'Custom...', url: 'custom' }
])

// Default to production proxy endpoint for better download performance
const selectedRpcEndpoint = ref(RPC_PROXY_PROD)
const customRpcEndpoint = ref('')
const rpcClient = ref(new SolanaRPC(selectedRpcEndpoint.value))

// Configuration - Solana networks as "catalogs" (simplified to match RPC endpoints)
const catalogs = ref([
  { name: 'Testnet', address: 'testnet' },
  { name: 'Custom...', address: 'custom' }
])
const selectedCatalogName = ref('Testnet') // Default to Testnet
const customCatalogAddress = ref('')

// Developer Mode
const developerMode = ref(false)
const showRetiredGames = ref(false)

// Visible catalogs (filter out dev-only catalogs unless in developer mode)
const visibleCatalogs = computed(() => {
  if (developerMode.value) {
    return catalogs.value
  }
  return catalogs.value.filter(c => !c.devOnly)
})

// Catalog address is actually the RPC URL for Solana
// Priority: Selected RPC endpoint > Custom RPC endpoint > Custom Network address > Network preset
const catalogAddress = computed(() => {
  // If RPC dropdown is set to "custom" and a custom URL is provided, use it
  if (selectedRpcEndpoint.value === 'custom' && customRpcEndpoint.value) {
    return customRpcEndpoint.value
  }
  
  // If RPC dropdown has a direct URL (starts with http), use it directly
  // This includes both preset URLs (like proxy) and any custom URLs
  if (selectedRpcEndpoint.value && 
      selectedRpcEndpoint.value !== 'custom' && 
      selectedRpcEndpoint.value.startsWith('http')) {
    return selectedRpcEndpoint.value
  }
  
  // Network dropdown custom
  if (selectedCatalogName.value === 'Custom...') {
    return customCatalogAddress.value || null
  }
  
  // Network preset (fallback)
  const catalog = catalogs.value.find(c => c.name === selectedCatalogName.value)
  if (!catalog) return 'https://api.testnet.solana.com'
  
  switch (catalog.address) {
    case 'testnet': return 'https://api.testnet.solana.com'
    default: return 'https://api.testnet.solana.com'
  }
})

// Publisher address (not used for Solana in the same way, but kept for compatibility)
const publisherAddress = ref('')

// Catalog and Cartridge
const selectedPlatform = ref(null)
const selectedGame = ref(null)
const selectedVersion = ref(null)

// Catalog composable (Solana)
const catalog = useSolanaCatalog(catalogAddress, showRetiredGames)
const { 
  loading: catalogLoading, 
  error: catalogError, 
  games: catalogGames, 
  loadCatalog 
} = catalog

// Cartridge ID (derived from selected version)
const cartridgeId = computed(() => {
  return selectedVersion.value?.cartridgeAddress || null
})

// Cartridge composable (Solana)
const cartridge = useSolanaCartridge(catalogAddress, cartridgeId)
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

// Auto-run setting (stored in localStorage)
const autoRunEnabled = ref(localStorage.getItem('solana-retro-autorun') !== 'false') // Default to true

// Watch autoRunEnabled to save to localStorage
watch(autoRunEnabled, (newValue) => {
  localStorage.setItem('solana-retro-autorun', String(newValue))
})

// Watch for cartridge loading completion to extract run.json and auto-run
watch([fileData, verified], async ([newFileData, newVerified]) => {
  if (newFileData && newVerified) {
    runJson.value = await extractRunJson()
    
    // Auto-run the game if enabled and not already running
    if (autoRunEnabled.value && !gameReady.value && !emulatorLoading.value) {
      // Small delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      try {
        await runGame()
      } catch (err) {
        console.error('Auto-run failed:', err)
      }
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

// Handle platform selection
async function onPlatformChange(platform) {
  // Stop current game if running
  if (gameReady.value) {
    await stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  selectedPlatform.value = platform
  // Reset game selection when platform changes
  selectedGame.value = null
  selectedVersion.value = null
  fileData.value = null
  verified.value = false
  runJson.value = null
  gameReady.value = false
  
  // Auto-select first game if platform is selected
  if (platform && catalogGames.value && catalogGames.value.length > 0) {
    const filteredGames = catalogGames.value.filter(game => game.platform === platform)
    if (filteredGames.length > 0) {
      onGameChange(filteredGames[0])
    }
  }
}

// Handle game selection
async function onGameChange(game) {
  // Stop current game if running
  if (gameReady.value) {
    await stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  // Reset manual stop flag when selecting a new game
  wasManuallyStopped.value = false
  
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
  gameReady.value = false
}

// Handle catalog selection (network change for Solana)
async function onCatalogChange(catalogName) {
  // Stop current game if running
  if (gameReady.value) {
    await stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  selectedCatalogName.value = catalogName
  // Update RPC endpoint to match
  const catalog = catalogs.value.find(c => c.name === catalogName)
  if (catalog && catalog.address !== 'custom') {
    switch (catalog.address) {
      case 'testnet':
        selectedRpcEndpoint.value = 'https://api.testnet.solana.com'
        break
    }
    rpcClient.value = new SolanaRPC(selectedRpcEndpoint.value)
  }
  
  // Reset platform, game selection and reload catalog
  selectedPlatform.value = null
  selectedGame.value = null
  selectedVersion.value = null
  fileData.value = null
  verified.value = false
  runJson.value = null
  gameReady.value = false
  
  // Reload catalog with new network
  if (catalogName !== 'Custom...' || customCatalogAddress.value) {
    loadCatalog()
  }
}

// Handle custom catalog address change (custom RPC URL for Solana)
async function onCustomCatalogChange(address) {
  // Stop current game if running
  if (gameReady.value) {
    await stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  customCatalogAddress.value = address
  if (address) {
    selectedRpcEndpoint.value = address
    rpcClient.value = new SolanaRPC(address)
  }
  // Reset game selection and reload catalog if address is set
  selectedGame.value = null
  selectedVersion.value = null
  fileData.value = null
  verified.value = false
  runJson.value = null
  gameReady.value = false
  if (address) {
    loadCatalog()
  }
}

// Handle version selection
async function onVersionChange(version) {
  // Stop current game if running
  if (gameReady.value) {
    await stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  // Reset manual stop flag when selecting a new version
  wasManuallyStopped.value = false
  
  selectedVersion.value = version
  // Reset cartridge state
  fileData.value = null
  verified.value = false
  runJson.value = null
  gameReady.value = false
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
  
  // Only load manifest info for display, don't download yet
  await loadCartridgeInfo()
}, { immediate: false })

// Emulator
const gameReady = ref(false)
const emulatorContainerRef = ref(null)
const welcomeModalRef = ref(null)
const wasManuallyStopped = ref(false) // Track if game was manually stopped

// Show the welcome modal (called from help button)
function showWelcomeModal() {
  welcomeModalRef.value?.show()
}

// Helper to convert platform code to string
function getPlatformName(platformCode) {
  if (typeof platformCode === 'string') return platformCode
  switch (platformCode) {
    case 0: return 'DOS'
    case 1: return 'GB'
    case 2: return 'GBC'
    case 3: return 'NES'
    default: return 'DOS'
  }
}

// Computed platform name for EmulatorContainer
const currentPlatform = computed(() => {
  // Priority: run.json platform > cart header platform > metadata platform > default
  let platform = 'DOS'
  
  if (runJson.value?.platform) {
    platform = runJson.value.platform
  } else if (cartHeader.value?.metadata?.platform) {
    platform = cartHeader.value.metadata.platform
  } else if (cartHeader.value?.platform !== undefined) {
    platform = getPlatformName(cartHeader.value.platform)
  }
  
  // Normalize platform to uppercase for consistent comparison
  return typeof platform === 'string' ? platform.toUpperCase() : platform
})

// Create a manifest-like object for DOS emulator compatibility
const manifestForEmulator = computed(() => {
  if (!cartHeader.value && !runJson.value && !fileData.value) return null
  
  return {
    filename: runJson.value?.filename || 'game.zip',
    game_id: cartHeader.value?.cartridgeId || 0,
    total_size: cartHeader.value?.totalSize || (fileData.value?.length || 0),
    chunk_size: cartHeader.value?.chunkSize || 131072, // 128KB default for Solana
    network: selectedCatalogName.value.toLowerCase(),
    sender_address: cartHeader.value?.publisher || '',
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
  // Reset manual stop flag when starting a game (manual or auto)
  wasManuallyStopped.value = false
  
  const emulatorComponent = emulatorContainerRef.value?.emulatorRef
  const containerElement = emulatorComponent?.gameContainer
  
  if (!containerElement) {
    emulatorError.value = 'Game container not found in emulator component.'
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
    emulatorError.value = `Emulator for platform "${platform}" not yet implemented`
  }
}

async function stopGame() {
  // Mark as manually stopped to prevent auto-restart
  wasManuallyStopped.value = true
  
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
  
  gameReady.value = false
}

// Auto-start game when cartridge is downloaded and verified
watch([fileData, verified, loading, gameReady], async ([newFileData, newVerified, newLoading, newGameReady]) => {
  // Auto-start conditions:
  // 1. File data is available
  // 2. Cartridge is verified
  // 3. Not currently loading
  // 4. Game is not already running
  // 5. We have a selected version (game is selected)
  // 6. Game was NOT manually stopped (prevent auto-restart after stop)
  if (newFileData && newVerified && !newLoading && !newGameReady && selectedVersion.value && !wasManuallyStopped.value) {
    // Stop any currently running game first (safety check)
    if (gameReady.value) {
      await stopGame()
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // Small delay to ensure UI is ready
    await new Promise(resolve => setTimeout(resolve, 100))
    // Check conditions again after delay (in case something changed)
    if (fileData.value && verified.value && !loading.value && !gameReady.value && !wasManuallyStopped.value) {
      console.log('Auto-starting game...')
      await runGame()
    }
  }
}, { immediate: false })

// Developer mode
const localFileData = ref(null)
const localFileName = ref(null)

// RPC endpoint handlers
function onRpcEndpointChange(newEndpoint) {
  selectedRpcEndpoint.value = newEndpoint
  if (newEndpoint !== 'custom') {
    // Clear custom endpoint when switching to preset
    customRpcEndpoint.value = ''
    rpcClient.value = new SolanaRPC(newEndpoint)
    // Reset game state and reload catalog with new endpoint
    selectedPlatform.value = null
    selectedGame.value = null
    selectedVersion.value = null
    fileData.value = null
    verified.value = false
    runJson.value = null
    loadCatalog()
  }
}

// Normalize RPC URL - strip /websocket suffix if user accidentally included it
function normalizeRpcUrl(url) {
  if (!url) return url
  // Remove /websocket or /websocket/ from the path (before query string)
  try {
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/websocket')) {
      parsed.pathname = parsed.pathname.replace(/\/websocket$/, '')
    } else if (parsed.pathname.endsWith('/websocket/')) {
      parsed.pathname = parsed.pathname.replace(/\/websocket\/$/, '/')
    }
    return parsed.toString()
  } catch {
    // If URL parsing fails, try simple string replacement
    return url.replace(/\/websocket(\?|$)/, '$1')
  }
}

function onCustomRpcEndpointChange(newUrl) {
  // Normalize the URL (strip /websocket if present)
  const normalizedUrl = normalizeRpcUrl(newUrl)
  customRpcEndpoint.value = normalizedUrl
  
  if (normalizedUrl) {
    // Keep selectedRpcEndpoint as 'custom' so the input stays visible
    // The catalogAddress computed will use customRpcEndpoint
    rpcClient.value = new SolanaRPC(normalizedUrl)
    // Reset game state and reload catalog with new endpoint
    selectedPlatform.value = null
    selectedGame.value = null
    selectedVersion.value = null
    fileData.value = null
    verified.value = false
    runJson.value = null
    loadCatalog()
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

// Developer mode functions
const localFileInput = ref(null)

async function handleLocalFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  if (!file.name.toLowerCase().endsWith('.zip')) {
    emulatorError.value = 'Please select a ZIP file'
    return
  }
  
  emulatorLoading.value = true
  emulatorError.value = null
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    localFileData.value = new Uint8Array(arrayBuffer)
    localFileName.value = file.name
    console.log('Loaded local file:', file.name, 'Size:', localFileData.value.length)
  } catch (err) {
    emulatorError.value = `Failed to load file: ${err.message}`
    console.error('Error loading local file:', err)
  } finally {
    emulatorLoading.value = false
  }
}

async function runLocalGame() {
  if (!localFileData.value) {
    emulatorError.value = 'No local file loaded'
    return
  }
  
  // Stop any currently running game
  if (gameReady.value) {
    stopGame()
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // Reset state
  emulatorError.value = null
  emulatorLoading.value = true
  
  try {
    // Set fileData and verified to allow running
    fileData.value = localFileData.value
    verified.value = true
    cartHeader.value = {
      cartridgeId: '0',
      totalSize: localFileData.value.length,
      chunkSize: 131072,
      sha256: '',
      platform: 0, // DOS
      metadata: {}
    }
    runJson.value = null
    
    // Now run the game using the existing runGame function
    await runGame()
  } catch (err) {
    emulatorError.value = `Failed to run local game: ${err.message}`
    console.error('Error running local game:', err)
  } finally {
    emulatorLoading.value = false
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
  
  // Auto-load catalog on mount
  loadCatalog()
})

onUnmounted(() => {
  // Cleanup keyboard listener
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

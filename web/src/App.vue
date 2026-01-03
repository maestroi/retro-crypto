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
      :selected-protocol="selectedProtocolId"
      :protocols="protocols"
      :selected-rpc-endpoint="selectedRpcUrl"
      :custom-rpc-endpoint="customRpcUrl"
      :rpc-endpoints="protocolConfig.rpcEndpoints"
      :games="games"
      :selected-game="selectedGame"
      :selected-version="selectedVersion"
      :loading="catalogLoading || cartridgeLoading"
      :catalogs="visibleCatalogs"
      :selected-catalog-name="selectedCatalogName"
      :catalog-address="catalogAddress"
      :custom-catalog-address="customCatalogAddress"
      @update:protocol="onProtocolChange"
      @update:rpc-endpoint="onRpcEndpointChange"
      @update:custom-rpc="onCustomRpcEndpointChange"
      @update:catalog="onCatalogChange"
      @update:custom-catalog="onCustomCatalogChange"
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
            :games="games"
            :selected-game="selectedGame"
            :selected-version="selectedVersion"
            :selected-platform="selectedPlatform"
            :cart-header="cartHeader"
            :run-json="runJson"
            :sync-progress="progress"
            :verified="verified"
            :file-data="fileData"
            :loading="cartridgeLoading"
            :catalog-loading="catalogLoading"
            :error="error"
            :progress-percent="progressPercent"
            @update:platform="onPlatformChange"
            @update:game="onGameChange"
            @update:version="onVersionChange"
            @load-cartridge="downloadGame"
            @clear-cache="clearCartridgeCache"
          />

          <!-- Emulator Container -->
          <EmulatorContainer
            :platform="currentPlatform"
            :verified="verified"
            :loading="emulatorLoading"
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
import { formatBytes, getPlatformInfo } from './utils.js'
import { useProtocol } from './composables/useProtocol.js'
import { useRecentlyPlayed } from './composables/useRecentlyPlayed.js'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js'
import { useDosEmulator } from './composables/useDosEmulator.js'
import { useGbEmulator } from './composables/useGbEmulator.js'
import { useNesEmulator } from './composables/useNesEmulator.js'
import Header from './components/Header.vue'
import EmulatorContainer from './components/EmulatorContainer.vue'
import GameSelector from './components/GameSelector.vue'
import RecentlyPlayed from './components/RecentlyPlayed.vue'
import WelcomeModal from './components/WelcomeModal.vue'

// Protocol composable
const protocol = useProtocol()
const {
  selectedProtocolId,
  selectedRpcUrl,
  customRpcUrl,
  selectedCatalogName,
  customCatalogAddress,
  catalogAddress,
  protocolConfig,
  protocols,
  visibleCatalogs,
  catalogLoading,
  catalogError,
  games,
  cartridgeLoading,
  cartridgeError,
  cartHeader,
  fileData,
  verified,
  progress,
  progressPercent,
  setProtocol,
  setRpcEndpoint,
  setCustomRpcUrl,
  setCatalog,
  setCustomCatalogAddress,
  loadCatalog,
  loadCartridgeInfo,
  loadCartridge,
  extractRunJson,
  resetGameState,
  clearCartridgeCache,
  initialize
} = protocol

// Use developer mode from protocol composable
const developerMode = protocol.developerMode

// Game selection
const selectedPlatform = ref(null)
const selectedGame = ref(null)
const selectedVersion = ref(null)
const runJson = ref(null)

// Emulator state
const emulatorContainerRef = ref(null)
const welcomeModalRef = ref(null)
const gameReady = ref(false)
const emulatorLoading = ref(false)
const emulatorError = ref(null)

// Combined loading and error states
const loading = computed(() => catalogLoading.value || cartridgeLoading.value || emulatorLoading.value)
const error = computed(() => catalogError.value || cartridgeError.value || emulatorError.value)

// Recently Played
const { recentGames, addRecentGame, clearRecentGames } = useRecentlyPlayed()

// Keyboard shortcuts
const shortcutsEnabled = computed(() => gameReady.value)
const shortcutToast = ref(null)

const { shortcuts, toggleFullscreen, isPaused, isMuted, lastAction, isActive } = useKeyboardShortcuts({
  enabled: shortcutsEnabled,
  onFullscreen: (isFullscreen) => {
    console.log('[App] Fullscreen toggled:', isFullscreen)
  },
  onReset: async () => {
    if (gameReady.value) {
      console.log('[App] Resetting game...')
      await stopGame()
      setTimeout(() => runGame(), 200)
    }
  },
  onPause: (paused) => {
    console.log('[App] Pause toggled:', paused)
  },
  onMute: (muted) => {
    console.log('[App] Mute toggled:', muted)
  }
})

// Watch lastAction from keyboard shortcuts to show toast
watch(lastAction, (action) => {
  if (action) {
    shortcutToast.value = action
  }
})

// Show welcome modal
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
    case 3: return 'NES'
    default: return 'DOS'
  }
}

// Computed platform name for EmulatorContainer
const currentPlatform = computed(() => {
  if (runJson.value?.platform) {
    return runJson.value.platform.toUpperCase()
  }
  if (cartHeader.value?.platform !== undefined) {
    return getPlatformName(cartHeader.value.platform)
  }
  return selectedGame.value?.platform || 'DOS'
})

// Create a manifest-like object for emulator compatibility
const manifestForEmulator = computed(() => {
  if (!cartHeader.value && !runJson.value && !fileData.value) return null
  
  return {
    filename: runJson.value?.filename || 'game.zip',
    game_id: cartHeader.value?.cartridgeId || 0,
    total_size: cartHeader.value?.totalSize || (fileData.value?.length || 0),
    chunk_size: cartHeader.value?.chunkSize || 51,
    sha256: cartHeader.value?.sha256 || '',
    platform: currentPlatform.value,
    executable: runJson.value?.executable || null,
    title: runJson.value?.title || selectedGame.value?.title || null
  }
})

// Emulator composables
const dosEmulator = useDosEmulator(manifestForEmulator, fileData, verified, emulatorLoading, emulatorError, gameReady)
const gbEmulator = useGbEmulator(manifestForEmulator, fileData, verified, emulatorLoading, emulatorError, gameReady)
const nesEmulator = useNesEmulator(manifestForEmulator, fileData, verified, emulatorLoading, emulatorError, gameReady)

// Handle protocol/chain change
async function onProtocolChange(protocolId) {
  // Stop current game if running
  if (gameReady.value) await stopGame()
  
  // Reset all game state
  selectedPlatform.value = null
  selectedGame.value = null
  selectedVersion.value = null
  resetGameState()
  runJson.value = null
  
  // Switch protocol and reload catalog
  setProtocol(protocolId)
  loadCatalog()
}

// Handle platform selection
async function onPlatformChange(platform) {
  if (gameReady.value) await stopGame()
  selectedPlatform.value = platform
  selectedGame.value = null
  selectedVersion.value = null
  resetGameState()
  runJson.value = null
  
  // Auto-select first game if platform is selected
  if (platform && games.value && games.value.length > 0) {
    const filteredGames = games.value.filter(game => game.platform === platform)
    if (filteredGames.length > 0) {
      await onGameChange(filteredGames[0])
    }
  }
}

// Handle game selection
async function onGameChange(game) {
  if (gameReady.value) await stopGame()
  
  selectedGame.value = game
  if (game && game.versions && game.versions.length > 0) {
    selectedVersion.value = game.versions[0]
  } else {
    selectedVersion.value = null
  }
  resetGameState()
  runJson.value = null
  
  // Auto-start download when game is selected
  if (game && selectedVersion.value?.cartridgeAddress) {
    setTimeout(() => {
      downloadGame()
    }, 50)
  }
}

// Handle version selection
async function onVersionChange(version) {
  if (gameReady.value) await stopGame()
  
  selectedVersion.value = version
  resetGameState()
  runJson.value = null
  
  if (version?.cartridgeAddress) {
    setTimeout(() => {
      downloadGame()
    }, 50)
  }
}

// Handle catalog selection
function onCatalogChange(catalogName) {
  setCatalog(catalogName)
  selectedPlatform.value = null
  selectedGame.value = null
  selectedVersion.value = null
  resetGameState()
  runJson.value = null
  loadCatalog()
}

// Handle custom catalog address change
function onCustomCatalogChange(address) {
  setCustomCatalogAddress(address)
  selectedGame.value = null
  selectedVersion.value = null
  resetGameState()
  runJson.value = null
  if (address) loadCatalog()
}

// RPC endpoint handlers
function onRpcEndpointChange(newEndpoint) {
  setRpcEndpoint(newEndpoint)
  if (newEndpoint !== 'custom') {
    loadCatalog()
  }
}

function onCustomRpcEndpointChange(newUrl) {
  setCustomRpcUrl(newUrl)
  if (newUrl) loadCatalog()
}

// Download game - first check cache via loadCartridgeInfo, then download if needed
async function downloadGame() {
  if (!selectedVersion.value?.cartridgeAddress) return
  
  // First load cartridge info - this checks the cache
  await loadCartridgeInfo(selectedVersion.value.cartridgeAddress)
  
  // If already loaded from cache (verified will be true), skip download
  if (fileData.value && verified.value) {
    console.log('Game loaded from cache, skipping download')
    return
  }
  
  // Not in cache, download it
  await loadCartridge(selectedVersion.value.cartridgeAddress)
}

// Select a recently played game
async function selectRecentGame(recentGame) {
  if (gameReady.value) await stopGame()
  
  const game = games.value?.find(g => g.appId === recentGame.appId)
  if (game) {
    selectedPlatform.value = game.platform
    await onGameChange(game)
  }
}

// Run game
async function runGame() {
  const emulatorComponent = emulatorContainerRef.value?.emulatorRef
  const containerElement = emulatorComponent?.gameContainer
  
  if (!containerElement) {
    emulatorError.value = 'Game container not found in emulator component.'
    return
  }
  
  // Extract run.json if not already done
  if (!runJson.value && fileData.value && verified.value) {
    runJson.value = await extractRunJson()
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
  
  // Add to recently played
  if (selectedGame.value && selectedVersion.value) {
    addRecentGame({
      appId: selectedGame.value.appId,
      title: selectedGame.value.title,
      platform: selectedGame.value.platform,
      cartridgeAddress: selectedVersion.value.cartridgeAddress,
      version: selectedVersion.value.semver?.string,
      protocol: selectedProtocolId.value
    })
  }
}

// Stop game
async function stopGame() {
  const emulatorComponent = emulatorContainerRef.value?.emulatorRef
  const containerElement = emulatorComponent?.gameContainer
  
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
const localFileData = ref(null)
const localFileName = ref(null)
const localFileInput = ref(null)

async function handleLocalFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  
  if (!file.name.toLowerCase().endsWith('.zip')) {
    emulatorError.value = 'Please select a ZIP file'
    return
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    localFileData.value = new Uint8Array(arrayBuffer)
    localFileName.value = file.name
    console.log('Loaded local file:', file.name, 'Size:', localFileData.value.length)
  } catch (err) {
    emulatorError.value = `Failed to load file: ${err.message}`
    console.error('Error loading local file:', err)
  }
}

async function runLocalGame() {
  if (!localFileData.value) {
    emulatorError.value = 'No local file loaded'
    return
  }
  
  if (gameReady.value) {
    stopGame()
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  try {
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
    
    await runGame()
  } catch (err) {
    emulatorError.value = `Failed to run local game: ${err.message}`
    console.error('Error running local game:', err)
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

// Auto-select first platform when games are loaded
watch(games, (newGames) => {
  if (newGames && newGames.length > 0 && !selectedPlatform.value) {
    const platforms = [...new Set(newGames.map(g => g.platform).filter(Boolean))].sort()
    if (platforms.length > 0) {
      selectedPlatform.value = platforms[0]
      const filteredGames = newGames.filter(game => game.platform === platforms[0])
      if (filteredGames.length > 0) {
        onGameChange(filteredGames[0])
      }
    }
  }
}, { immediate: true })

// Auto-run when cartridge is verified
watch([fileData, verified], async ([newFileData, newVerified]) => {
  if (newFileData && newVerified) {
    runJson.value = await extractRunJson()
    
    // Auto-run the game
    if (!gameReady.value) {
      setTimeout(() => runGame(), 100)
    }
  } else {
    runJson.value = null
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  initialize()
  loadCatalog()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

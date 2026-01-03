<template>
  <div class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
    <div class="px-4 py-5 sm:px-6">
      <h2 class="text-xl font-semibold text-white">Select Game & Download</h2>
    </div>
    <div class="px-4 py-3 sm:p-4">
      <div class="space-y-2">
        <!-- Loading Skeleton -->
        <div v-if="catalogLoading" class="space-y-3 animate-pulse">
          <div>
            <div class="h-3 w-16 bg-gray-700 rounded mb-2"></div>
            <div class="h-8 w-full bg-gray-700 rounded"></div>
          </div>
          <div>
            <div class="h-3 w-20 bg-gray-700 rounded mb-2"></div>
            <div class="h-8 w-full bg-gray-700 rounded"></div>
          </div>
          <div class="pt-3">
            <div class="h-4 w-24 bg-gray-700 rounded mb-2"></div>
            <div class="h-3 w-full bg-gray-700 rounded mb-1"></div>
            <div class="h-3 w-3/4 bg-gray-700 rounded"></div>
          </div>
        </div>

        <template v-else>
          <!-- Search Input -->
          <div v-if="games && games.length > 3">
            <label class="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <div class="relative">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="Search games..."
                class="w-full text-xs rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1.5 pr-8"
              />
              <button
                v-if="searchQuery"
                @click="searchQuery = ''"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Platform Selection -->
          <div v-if="availablePlatforms.length > 0">
            <label class="block text-xs font-medium text-gray-400 mb-1">Platform</label>
            <div class="flex flex-wrap gap-1.5 mb-1">
              <button
                @click="onPlatformSelect('')"
                :class="[
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  !selectedPlatform 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                ]"
              >
                All ({{ games?.length || 0 }})
              </button>
              <button
                v-for="platform in availablePlatforms"
                :key="platform"
                @click="onPlatformSelect(platform)"
                :class="[
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  selectedPlatform === platform 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                ]"
              >
                {{ platform }} ({{ platformCounts[platform] || 0 }})
              </button>
            </div>
          </div>
          
          <!-- Game Selection -->
          <div v-if="selectedPlatform || availablePlatforms.length === 0 || searchQuery">
            <label class="block text-xs font-medium text-gray-400 mb-1">
              Game
              <span v-if="searchedGames.length > 0" class="text-gray-500 font-normal">({{ searchedGames.length }} {{ searchedGames.length === 1 ? 'result' : 'results' }})</span>
              <span v-if="selectedGame" class="ml-2 text-xs text-gray-500 font-normal">(ID: {{ selectedGame.appId }})</span>
            </label>
            <!-- No results message -->
            <div v-if="searchQuery && searchedGames.length === 0" class="text-xs text-gray-400 py-2">
              No games found matching "{{ searchQuery }}"
            </div>
            <select
              v-else
              :value="selectedGame ? selectedGame.appId : ''"
              @change="onGameSelect($event.target.value)"
              class="w-full text-xs rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1.5"
            >
              <option value="">-- Select Game --</option>
              <option v-for="game in searchedGames" :key="game.appId" :value="game.appId">
                {{ game.title }}{{ game.retired ? ' (Retired)' : '' }}
              </option>
            </select>
          </div>
        </template>
        
        <!-- Version Selection -->
        <div v-if="selectedGame && selectedGame.versions.length > 0">
          <label class="block text-xs font-medium text-gray-400 mb-1">Version</label>
          <select
            :value="selectedVersion ? selectedVersion.semver.string : ''"
            @change="onVersionSelect($event.target.value)"
            class="w-full text-xs rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1.5"
          >
            <option value="">-- Select Version --</option>
            <option v-for="version in selectedGame.versions" :key="version.semver.string" :value="version.semver.string">
              v{{ version.semver.string }}
            </option>
          </select>
        </div>
        
        <!-- Game Description/Title (when game selected) -->
        <div v-if="selectedGame" class="pt-4 border-t border-gray-700 dark:border-white/10">
          <div class="text-sm">
            <h3 class="text-base font-semibold text-white mb-1">{{ runJson?.title || selectedGame?.title }}</h3>
            <p v-if="runJson?.description" class="text-xs text-gray-300 mt-1">{{ runJson.description }}</p>
          </div>
        </div>
        
        <!-- Cartridge Info (when version selected) -->
        <div v-if="selectedVersion && (cartHeader || runJson)" class="pt-4 border-t border-gray-700 dark:border-white/10">
          <h3 class="text-sm font-semibold text-white mb-3">Cartridge Info</h3>
          <dl class="space-y-2 text-sm">
            <div v-if="platformName">
              <dt class="text-xs font-medium text-gray-400">Platform</dt>
              <dd class="mt-0.5 text-white">{{ platformName }}</dd>
            </div>
            <div v-if="cartHeader">
              <dt class="text-xs font-medium text-gray-400">Total Size</dt>
              <dd class="mt-0.5 text-sm text-white">{{ formatBytes(cartHeader.totalSize) }}</dd>
            </div>
            <div v-if="cartHeader">
              <dt class="text-xs font-medium text-gray-400">SHA256</dt>
              <dd class="mt-0.5 text-xs text-white font-mono break-words flex items-center gap-2">
                <span>{{ formatHash(cartHeader.sha256) }}</span>
                <span v-if="verified" class="inline-flex items-center text-green-400" title="SHA256 verified">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </span>
              </dd>
            </div>
            <div v-if="cartHeader && cartHeader.publisherVerified !== undefined">
              <dt class="text-xs font-medium text-gray-400">Publisher</dt>
              <dd class="mt-0.5 text-xs text-white flex items-center gap-2">
                <span v-if="cartHeader.publisherVerified" class="inline-flex items-center text-green-400">
                  <svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  Verified
                </span>
                <span v-else class="inline-flex items-center text-yellow-400">
                  <svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Not verified
                </span>
              </dd>
            </div>
            <!-- Locked Rent Cost -->
            <div v-if="cartHeader && rentCost">
              <dt class="text-xs font-medium text-gray-400 flex items-center gap-1">
                Locked Rent
                <span class="text-gray-500 cursor-help" title="SOL locked for rent-exempt storage on Solana. This is the cost to keep this cartridge permanently on-chain.">
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </dt>
              <dd class="mt-0.5 text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-purple-400 font-medium">◎ {{ rentCost.sol.toFixed(4) }} SOL</span>
                  <span v-if="solPrice" class="text-gray-400">(~${{ rentCost.usd.toFixed(2) }})</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5">
                  {{ cartHeader.numChunks || Math.ceil(cartHeader.totalSize / (cartHeader.chunkSize || 800)) }} chunks × ~0.006 SOL each
                </div>
              </dd>
            </div>
          </dl>
        </div>

        <!-- Download Progress -->
        <div v-if="(loading || verified) && selectedVersion && syncProgress && (syncProgress.expectedChunks > 0 || syncProgress.txPagesFetched > 0)" class="pt-4 border-t border-gray-700 dark:border-white/10">
          <h3 class="text-sm font-semibold text-white mb-2">Download Progress</h3>
          
          <div v-if="syncProgress && (syncProgress.expectedChunks > 0 || syncProgress.txPagesFetched > 0)" class="space-y-2">
            <!-- Transaction Fetching Progress -->
            <div v-if="syncProgress.txEstimatedPages > 0 || syncProgress.txPagesFetched > 0">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-gray-400">Fetching Transactions</span>
                <span class="text-white font-medium">
                  <span v-if="syncProgress.txPagesFetched > 0">Page {{ syncProgress.txPagesFetched }}</span>
                  <span v-if="syncProgress.txEstimatedPages > 0"> / {{ syncProgress.txEstimatedPages }}</span>
                  <span v-if="syncProgress.txTotalFetched > 0"> ({{ syncProgress.txTotalFetched.toLocaleString() }} tx)</span>
                  <span v-else-if="syncProgress.phase === 'fetching-txs'">...</span>
                </span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden relative">
                <div
                  class="bg-blue-600 h-full rounded-full transition-all duration-300 absolute left-0 top-0"
                  :style="{ width: syncProgress.txEstimatedPages > 0 ? `${Math.min(100, Math.max(0, (syncProgress.txPagesFetched / syncProgress.txEstimatedPages * 100)))}%` : (syncProgress.phase === 'fetching-txs' ? '10%' : '100%') }"
                ></div>
              </div>
            </div>
            <div v-if="syncProgress.expectedChunks > 0">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-gray-400">Chunks</span>
                <span class="text-white font-medium">{{ syncProgress.chunksFound.toLocaleString() }} / {{ syncProgress.expectedChunks.toLocaleString() }}</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden relative">
                <div
                  class="bg-indigo-600 h-full rounded-full transition-all duration-300 absolute left-0 top-0"
                  :style="{ width: `${Math.round(progressPercent)}%` }"
                  :title="`${Math.round(progressPercent)}% (${syncProgress.chunksFound}/${syncProgress.expectedChunks})`"
                ></div>
              </div>
            </div>
            <div v-if="cartHeader">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-gray-400">Bytes</span>
                <span class="text-white font-medium">{{ formatBytes(syncProgress.bytes) }} / {{ formatBytes(cartHeader.totalSize) }}</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden relative">
                <div
                  class="bg-green-600 h-full rounded-full transition-all duration-300 absolute left-0 top-0"
                  :style="{ width: cartHeader && cartHeader.totalSize > 0 ? `${Math.min(100, Math.max(0, (syncProgress.bytes / cartHeader.totalSize * 100)))}%` : '0%' }"
                ></div>
              </div>
            </div>
            <div class="text-center pt-1">
              <span class="text-lg font-bold text-white">{{ Math.round(combinedProgress) }}%</span>
              <span class="text-xs text-gray-400 ml-1">Complete</span>
            </div>
            <div v-if="syncProgress.rate > 0" class="text-center pt-1">
              <span class="text-xs text-gray-400">Speed: </span>
              <span class="text-xs text-white font-medium">{{ syncProgress.rate.toFixed(1) }} chunks/s</span>
            </div>
          </div>
          <div v-else class="space-y-2">
            <div class="flex items-center justify-center py-4">
              <svg class="animate-spin h-5 w-5 text-indigo-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm text-gray-300">{{ syncProgress?.statusMessage || 'Loading cartridge information...' }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    
    <!-- Download Button -->
    <div class="px-4 py-4 sm:px-6 border-t border-gray-700 dark:border-white/10">
      <!-- Auto-run toggle -->
      <div class="flex items-center justify-between mb-3">
        <label class="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            :checked="autoRunEnabled"
            @change="$emit('update:auto-run', $event.target.checked)"
            class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-green-500 focus:ring-offset-gray-800 cursor-pointer"
          />
          <span class="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Auto-run after download</span>
        </label>
      </div>
      <div class="flex gap-2">
        <button
          @click="$emit('load-cartridge')"
          :disabled="loading || !selectedVersion"
          class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else-if="verified && fileData" class="-ml-1 mr-2 h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="-ml-1 mr-2 h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {{ verified && fileData ? 'Re-sync' : (loading ? 'Downloading...' : 'Download Cartridge') }}
        </button>
        <button
          v-if="verified && fileData"
          @click="$emit('clear-cache')"
          :disabled="loading"
          class="inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear cache and force re-download"
        >
          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <!-- Status indicator -->
      <div v-if="verified && fileData" class="mt-2 text-xs text-green-400 flex items-center">
        <svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span>Downloaded and verified</span>
      </div>
      <div v-else-if="!loading && !cartHeader && selectedVersion" class="mt-2 text-xs text-gray-400">
        Click "Download Cartridge" to start downloading
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { formatBytes, formatHash } from '../utils.js'

const props = defineProps({
  games: Array,
  selectedGame: Object,
  selectedVersion: Object,
  selectedPlatform: String,
  cartHeader: Object,
  runJson: Object,
  syncProgress: Object,
  verified: Boolean,
  fileData: Object,
  loading: Boolean,
  catalogLoading: Boolean,
  error: String,
  progressPercent: Number,
  autoRunEnabled: {
    type: Boolean,
    default: true
  }
})

// SOL price in USD (fetched on mount)
const solPrice = ref(null)

// Fetch SOL price from CoinGecko
async function fetchSolPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const data = await response.json()
    solPrice.value = data.solana?.usd || null
  } catch (e) {
    console.warn('Failed to fetch SOL price:', e)
    solPrice.value = null
  }
}

onMounted(() => {
  fetchSolPrice()
})

// Calculate rent cost for the cartridge
// Solana rent-exempt minimum: ~0.00000348 SOL per byte (for 2 years)
// Account overhead: 128 bytes
// Chunk size: ~900 bytes data + 128 bytes overhead = ~1028 bytes per chunk
// Manifest: ~200 bytes data + 128 bytes overhead = ~328 bytes
const RENT_PER_BYTE = 0.00000696 // SOL per byte (rent-exempt)
const ACCOUNT_OVERHEAD = 128 // bytes
const CHUNK_DATA_SIZE = 900 // bytes per chunk
const MANIFEST_DATA_SIZE = 200 // approximate manifest size

const rentCost = computed(() => {
  if (!props.cartHeader) return null
  
  // Use actual numChunks from manifest, or calculate from totalSize and chunkSize
  const chunkSize = props.cartHeader.chunkSize || CHUNK_DATA_SIZE
  const chunkCount = props.cartHeader.numChunks || Math.ceil(props.cartHeader.totalSize / chunkSize)
  
  // Calculate total bytes stored on-chain
  const manifestBytes = ACCOUNT_OVERHEAD + MANIFEST_DATA_SIZE
  const chunkBytes = chunkCount * (ACCOUNT_OVERHEAD + chunkSize)
  const totalBytes = manifestBytes + chunkBytes
  
  const solCost = totalBytes * RENT_PER_BYTE
  const usdCost = solPrice.value ? solCost * solPrice.value : 0
  
  return {
    sol: solCost,
    usd: usdCost,
    totalBytes,
    chunkCount
  }
})

const emit = defineEmits(['update:platform', 'update:game', 'update:version', 'load-cartridge', 'clear-cache', 'update:auto-run'])

// Search query state
const searchQuery = ref('')

// Compute available platforms (only platforms that have games)
const availablePlatforms = computed(() => {
  if (!props.games || props.games.length === 0) return []
  const platforms = new Set()
  props.games.forEach(game => {
    if (game.platform) {
      platforms.add(game.platform)
    }
  })
  return Array.from(platforms).sort()
})

// Count games per platform for the filter buttons
const platformCounts = computed(() => {
  if (!props.games || props.games.length === 0) return {}
  const counts = {}
  props.games.forEach(game => {
    if (game.platform) {
      counts[game.platform] = (counts[game.platform] || 0) + 1
    }
  })
  return counts
})

// Filter games by selected platform
const filteredGames = computed(() => {
  if (!props.games || props.games.length === 0) return []
  if (!props.selectedPlatform) return props.games
  return props.games.filter(game => game.platform === props.selectedPlatform)
})

// Filter games by search query (searches title and platform)
const searchedGames = computed(() => {
  if (!searchQuery.value) return filteredGames.value
  const query = searchQuery.value.toLowerCase().trim()
  return filteredGames.value.filter(game => {
    const title = (game.title || '').toLowerCase()
    const platform = (game.platform || '').toLowerCase()
    return title.includes(query) || platform.includes(query)
  })
})

function onPlatformSelect(platform) {
  emit('update:platform', platform || null)
}

function onGameSelect(appId) {
  // Support both numeric (Nimiq legacy) and string (Solana) app IDs
  const game = filteredGames.value?.find(g => String(g.appId) === String(appId))
  emit('update:game', game || null)
}

function onVersionSelect(semverString) {
  if (!props.selectedGame) return
  const version = props.selectedGame.versions.find(v => v.semver.string === semverString)
  emit('update:version', version || null)
}

const platformName = computed(() => {
  if (props.runJson?.platform) return props.runJson.platform
  // Check metadata first (Solana stores platform in metadata)
  if (props.cartHeader?.metadata?.platform) return props.cartHeader.metadata.platform
  if (!props.cartHeader) return null
  const platformCode = props.cartHeader.platform
  if (typeof platformCode === 'string') return platformCode
  return platformCode === 0 ? 'DOS' : 
         platformCode === 1 ? 'GB' :
         platformCode === 2 ? 'GBC' :
         platformCode === 3 ? 'NES' : `Platform ${platformCode}`
})

// Combined progress that accounts for streaming (fetch + parse happen simultaneously)
// With streaming optimization:
// - Chunk progress is the PRIMARY indicator (0-90%)
// - Reconstruction/verification is the final phase (90-100%)
const combinedProgress = computed(() => {
  if (!props.syncProgress) return 0
  
  const progress = props.syncProgress
  
  // If we have expected chunks, use chunk progress as the primary indicator
  if (progress.expectedChunks > 0) {
    const chunkProgress = Math.min(1, progress.chunksFound / progress.expectedChunks)
    
    // Chunks done - now reconstruction/verification (90-100%)
    if (progress.chunksFound >= progress.expectedChunks) {
      if (props.cartHeader && props.cartHeader.totalSize > 0 && progress.bytes > 0) {
        const byteProgress = Math.min(1, progress.bytes / props.cartHeader.totalSize)
        return 90 + (byteProgress * 10) // 90% base + up to 10% for reconstruction
      }
      // Chunks done, waiting for reconstruction
      return 90
    }
    
    // Still fetching/parsing chunks (0-90%)
    return chunkProgress * 90
  }
  
  // Fallback: only tx progress available (early phase)
  if (progress.txEstimatedPages > 0) {
    const txProgress = Math.min(1, progress.txPagesFetched / progress.txEstimatedPages)
    return txProgress * 10 // Only show up to 10% for tx fetching alone
  }
  
  if (progress.phase === 'fetching-txs') {
    return 5 // Show some progress while fetching
  }
  
  return 0
})
</script>


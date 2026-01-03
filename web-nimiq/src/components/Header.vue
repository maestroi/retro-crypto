<template>
  <div class="bg-gray-800 border-b border-gray-700">
    <div class="max-w-[95rem] mx-auto px-4 sm:px-6 lg:px-8 py-2">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex items-start gap-3">
          <div>
            <h1 class="text-xl md:text-2xl font-bold text-white">🎮 Nimiq: Retro Games Onchain</h1>
            <p class="mt-0.5 text-xs text-gray-400">Download retro games from the blockchain and play them in your browser!</p>
          </div>
          <!-- Help Button - Opens Welcome Modal -->
          <button
            @click="$emit('show-help')"
            class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20"
            title="How It Works"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="hidden sm:inline">How It Works</span>
          </button>
        </div>
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- RPC Endpoint Selection -->
          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-xs font-medium text-gray-400 whitespace-nowrap">RPC:</label>
            <select
              :value="selectedRpcEndpoint"
              @change="$emit('update:rpc-endpoint', ($event.target).value)"
              class="text-sm rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-1.5 min-w-[200px]"
            >
              <option v-for="endpoint in rpcEndpoints" :key="endpoint.url" :value="endpoint.url">
                {{ endpoint.name }}
              </option>
            </select>
            <input
              v-if="selectedRpcEndpoint === 'custom'"
              :value="customRpcEndpoint"
              @input="$emit('update:custom-rpc', $event.target.value)"
              @keyup.enter="$emit('update:custom-rpc', $event.target.value)"
              placeholder="Enter RPC URL (e.g., https://rpc-mainnet.nimiqscan.com)"
              type="url"
              class="text-sm rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-1.5 min-w-[300px] flex-1"
            />
          </div>
          <!-- Catalog Selection -->
          <div v-if="catalogs && catalogs.length > 0" class="flex items-center gap-2 flex-wrap">
            <label class="text-xs font-medium text-gray-400 whitespace-nowrap">Catalog:</label>
            <select
              :value="selectedCatalogName"
              @change="$emit('update:catalog', ($event.target).value)"
              class="text-sm rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-1.5 min-w-[120px]"
            >
              <option v-for="catalog in catalogs" :key="catalog.name" :value="catalog.name">
                {{ catalog.name }}
              </option>
            </select>
            <input
              v-if="selectedCatalogName === 'Custom...'"
              :value="customCatalogAddress"
              @input="$emit('update:custom-catalog', $event.target.value)"
              @keyup.enter="$emit('update:custom-catalog', $event.target.value)"
              placeholder="Enter catalog address (e.g., NQ32 0VD4...)"
              type="text"
              class="text-sm rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-1.5 min-w-[300px] flex-1"
            />
          </div>
          <!-- Refresh Catalog Button -->
          <div v-if="catalogAddress" class="flex items-center">
            <button
              @click="$emit('refresh-catalog')"
              :disabled="loading"
              class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh Catalog"
            >
              <svg v-if="loading" class="animate-spin h-3 w-3 text-white mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="h-3 w-3 text-white mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  selectedRpcEndpoint: String,
  customRpcEndpoint: String,
  rpcEndpoints: Array,
  games: Array,
  selectedGame: Object,
  selectedVersion: Object,
  loading: Boolean,
  catalogs: Array,
  selectedCatalogName: String,
  catalogAddress: String,
  customCatalogAddress: String,
  publisherAddress: String
})

const emit = defineEmits([
  'update:rpc-endpoint',
  'update:custom-rpc',
  'update:catalog',
  'update:custom-catalog',
  'update:game',
  'update:version',
  'refresh-catalog',
  'show-help'
])

function onGameSelect(appId) {
  const game = props.games?.find(g => g.appId === Number(appId))
  emit('update:game', game || null)
}

function onVersionSelect(semverString) {
  if (!props.selectedGame) return
  const version = props.selectedGame.versions.find(v => v.semver.string === semverString)
  emit('update:version', version || null)
}
</script>

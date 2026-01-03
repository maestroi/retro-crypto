<template>
  <div v-if="cartHeader || runJson" class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
    <div class="px-4 py-5 sm:px-6">
      <h2 class="text-xl font-semibold text-white">Cartridge Info</h2>
    </div>
    <div class="px-4 py-5 sm:p-6">
      <dl class="space-y-2">
        <div v-if="runJson?.title">
          <dt class="text-xs font-medium text-gray-400">Title</dt>
          <dd class="mt-0.5 text-sm text-white font-semibold">{{ runJson.title }}</dd>
        </div>
        <div v-if="platformName">
          <dt class="text-xs font-medium text-gray-400">Platform</dt>
          <dd class="mt-0.5 text-sm text-white">{{ platformName }}</dd>
        </div>
        <div v-if="runJson?.filename">
          <dt class="text-xs font-medium text-gray-400">Filename</dt>
          <dd class="mt-0.5 text-sm text-white font-mono text-xs">{{ runJson.filename }}</dd>
        </div>
        <div v-if="cartHeader">
          <dt class="text-xs font-medium text-gray-400">Cartridge ID</dt>
          <dd class="mt-0.5 text-sm text-white">{{ cartHeader.cartridgeId }}</dd>
        </div>
        <div v-if="cartHeader">
          <dt class="text-xs font-medium text-gray-400">Total Size</dt>
          <dd class="mt-0.5 text-sm text-white">{{ formatBytes(cartHeader.totalSize) }}</dd>
        </div>
        <div v-if="cartHeader">
          <dt class="text-xs font-medium text-gray-400">Chunk Size</dt>
          <dd class="mt-0.5 text-sm text-white">{{ cartHeader.chunkSize }} bytes</dd>
        </div>
        <div v-if="cartHeader">
          <dt class="text-xs font-medium text-gray-400">Expected Chunks</dt>
          <dd class="mt-0.5 text-sm text-white">{{ Math.ceil(cartHeader.totalSize / cartHeader.chunkSize).toLocaleString() }}</dd>
        </div>
        <div v-if="cartHeader">
          <dt class="text-xs font-medium text-gray-400">SHA256</dt>
          <dd class="mt-0.5 text-xs text-white font-mono break-words">{{ formatHash(cartHeader.sha256) }}</dd>
        </div>
        <div v-if="runJson?.executable">
          <dt class="text-xs font-medium text-gray-400">Executable</dt>
          <dd class="mt-0.5 text-sm text-white font-mono text-xs">{{ runJson.executable }}</dd>
        </div>
      </dl>

      <!-- Download Progress -->
      <div v-if="syncProgress && syncProgress.expectedChunks > 0" class="mt-4 pt-4 border-t border-gray-700 dark:border-white/10">
        <h3 class="text-sm font-semibold text-white mb-2">Download Progress</h3>
        <div class="space-y-2">
          <div>
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
            <span class="text-lg font-bold text-white">{{ Math.round(progressPercent) }}%</span>
            <span class="text-xs text-gray-400 ml-1">Complete</span>
          </div>
          <div v-if="syncProgress.rate > 0" class="text-center pt-1">
            <span class="text-xs text-gray-400">Speed: </span>
            <span class="text-xs text-white font-medium">{{ syncProgress.rate.toFixed(1) }} chunks/s</span>
          </div>
        </div>
      </div>

      <!-- File Verification -->
      <div v-if="verified && !error" class="mt-3 pt-3 border-t border-gray-700 dark:border-white/10">
        <div class="flex items-center">
          <svg class="h-4 w-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <div>
            <div class="text-xs font-medium text-green-200">File Verified</div>
            <div class="text-xs text-green-300">SHA256 verified</div>
          </div>
        </div>
      </div>
    </div>
    <div class="px-4 py-4 sm:px-6">
      <!-- Load Cartridge Button -->
      <div class="flex gap-2">
        <button
          @click="$emit('load-cartridge')"
          :disabled="loading"
          class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else-if="verified && fileData" class="-ml-1 mr-2 h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ verified && fileData ? 'Re-sync' : (loading ? 'Downloading...' : 'Download Cartridge') }}
        </button>
      </div>
      <!-- Status indicator -->
      <div v-if="verified && fileData" class="mt-2 text-xs text-green-400 flex items-center">
        <svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span>Downloaded and verified</span>
      </div>
      <div v-else-if="!loading && !cartHeader" class="mt-2 text-xs text-gray-400">
        Select a game version to download
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatBytes, formatHash } from '../utils.js'

const props = defineProps({
  cartHeader: Object,
  runJson: Object,
  syncProgress: Object,
  verified: Boolean,
  fileData: Object,
  loading: Boolean,
  error: String,
  progressPercent: Number
})

const platformName = computed(() => {
  if (props.runJson?.platform) return props.runJson.platform
  if (!props.cartHeader) return null
  const platformCode = props.cartHeader.platform
  return platformCode === 0 ? 'DOS' : 
         platformCode === 1 ? 'GB' :
         platformCode === 2 ? 'GBC' : `Platform ${platformCode}`
})

defineEmits(['load-cartridge'])
</script>

<template>
  <!-- Error Boundary: Show friendly error when emulator crashes -->
  <div v-if="hasError" class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
    <div class="px-4 py-5 sm:px-6">
      <h2 class="text-xl font-semibold text-red-400 flex items-center gap-2">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Emulator Error
      </h2>
    </div>
    <div class="px-4 py-5 sm:p-6">
      <div class="text-center py-8">
        <p class="text-red-300 mb-4">The emulator encountered an error and stopped.</p>
        <p class="text-gray-400 text-sm mb-6 font-mono bg-gray-900/50 px-4 py-2 rounded">{{ errorMessage }}</p>
        <button
          @click="clearError"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          <svg class="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    </div>
    <div class="px-4 py-4 sm:px-6">
      <button
        @click="$emit('download-file')"
        :disabled="!verified || loading"
        class="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-transparent hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download File Instead
      </button>
    </div>
  </div>
  
  <!-- Normal emulator components -->
  <DosEmulator
    v-else-if="platform === 'DOS'"
    :verified="verified"
    :loading="loading"
    :game-ready="gameReady"
    @run-game="$emit('run-game')"
    @stop-game="$emit('stop-game')"
    @download-file="$emit('download-file')"
    ref="emulatorRef"
  />
  <GameBoyEmulator
    v-else-if="platform === 'GB' || platform === 'GBC'"
    :verified="verified"
    :loading="loading"
    :game-ready="gameReady"
    :platform="platform"
    @run-game="$emit('run-game')"
    @stop-game="$emit('stop-game')"
    @download-file="$emit('download-file')"
    ref="emulatorRef"
  />
  <NesEmulator
    v-else-if="platform === 'NES'"
    :verified="verified"
    :loading="loading"
    :game-ready="gameReady"
    @run-game="$emit('run-game')"
    @stop-game="$emit('stop-game')"
    @download-file="$emit('download-file')"
    ref="emulatorRef"
  />
  <div v-else class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
    <div class="px-4 py-5 sm:px-6">
      <h2 class="text-xl font-semibold text-white">{{ platform || 'Unknown' }} Emulator</h2>
    </div>
    <div class="px-4 py-5 sm:p-6">
      <div class="text-center py-8 text-gray-500">
        <p class="text-sm">Emulator support for "{{ platform || 'Unknown' }}" platform is not yet implemented.</p>
        <p class="text-xs mt-2">Platform: {{ platform || 'Not specified' }}</p>
      </div>
    </div>
    <div class="px-4 py-4 sm:px-6">
      <button
        @click="$emit('download-file')"
        :disabled="!verified || loading"
        class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download File
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured, watch } from 'vue'
import DosEmulator from './emulators/DosEmulator.vue'
import GameBoyEmulator from './emulators/GameBoyEmulator.vue'
import NesEmulator from './emulators/NesEmulator.vue'

const props = defineProps({
  platform: String,
  verified: Boolean,
  loading: Boolean,
  gameReady: Boolean
})

const emulatorRef = ref(null)

// Error boundary state
const hasError = ref(false)
const errorMessage = ref('')

/**
 * Error boundary - catches errors from child emulator components
 * Shows a friendly error message instead of crashing
 */
onErrorCaptured((error, instance, info) => {
  console.error('[EmulatorContainer] Caught error from child component:', error)
  console.error('[EmulatorContainer] Error info:', info)
  
  hasError.value = true
  errorMessage.value = error?.message || 'An unexpected error occurred'
  
  // Return false to prevent error from propagating further
  return false
})

/**
 * Clear error state and allow retry
 */
function clearError() {
  hasError.value = false
  errorMessage.value = ''
}

// Clear error when platform changes (user selected different game)
watch(() => props.platform, () => {
  if (hasError.value) {
    clearError()
  }
})

// Expose emulator ref to parent
defineExpose({
  emulatorRef,
  hasError,
  clearError
})

defineEmits(['run-game', 'stop-game', 'download-file'])
</script>

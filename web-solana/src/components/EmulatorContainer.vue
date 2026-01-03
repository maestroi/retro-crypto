<template>
  <DosEmulator
    v-if="platform === 'DOS'"
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
import { ref } from 'vue'
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

// Expose emulator ref to parent
defineExpose({
  emulatorRef
})

defineEmits(['run-game', 'stop-game', 'download-file'])
</script>

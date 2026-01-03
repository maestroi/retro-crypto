<template>
  <div class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
    <div class="px-4 py-5 sm:px-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-semibold text-white flex items-center gap-2">
          <svg class="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-11 8H8v-2H6v2H4v-2H6v-2H4V8h2v2h2V8h2v4zm5.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 10 18.5 10s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
          NES Emulator
        </h2>
        <span class="px-2 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
          Nintendo
        </span>
      </div>
      <!-- Action Buttons - Small Icon Buttons -->
      <div class="flex items-center gap-2">
        <button
          v-if="!gameReady"
          @click="$emit('run-game')"
          :disabled="!verified || loading"
          class="inline-flex items-center justify-center p-2 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run Game"
        >
          <svg v-if="loading" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          v-else
          @click="$emit('stop-game')"
          class="inline-flex items-center justify-center p-2 border border-transparent rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          title="Stop Emulation"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6v4H9z" />
          </svg>
        </button>
        <button
          @click="$emit('download-file')"
          :disabled="!verified || loading"
          class="inline-flex items-center justify-center p-2 border border-transparent rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download File"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
    </div>
    <div class="px-4 py-5 sm:p-6">
      <!-- Container for emulator iframe - Vue doesn't manage content here -->
      <div 
        ref="gameContainer" 
        class="bg-gray-900 rounded w-full mb-4 overflow-hidden relative" 
        style="min-height: 720px;"
      >
        <!-- Placeholder shown when emulator not running -->
        <div 
          v-show="!gameReady" 
          class="absolute inset-0 flex items-center justify-center"
        >
          <div v-if="!verified" class="text-center text-gray-500 p-8">
            <svg class="mx-auto h-16 w-16 text-red-400/50 mb-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-11 8H8v-2H6v2H4v-2H6v-2H4V8h2v2h2V8h2v4zm5.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 10 18.5 10s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
            <p class="text-sm mb-2 text-gray-400">Nintendo Entertainment System</p>
            <p class="text-xs text-gray-500">Powered by JSNES</p>
            <p class="text-xs mt-4 text-gray-500">Sync and verify a NES ROM to play</p>
          </div>
          <div v-else class="text-center text-gray-400 p-8">
            <svg class="mx-auto h-16 w-16 text-red-400 mb-4 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-11 8H8v-2H6v2H4v-2H6v-2H4V8h2v2h2V8h2v4zm5.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 10 18.5 10s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
            <p class="text-sm mb-2">ROM Verified ✓</p>
            <p class="text-xs text-gray-500">Click "Run Game" to start the emulator</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  verified: Boolean,
  loading: Boolean,
  gameReady: Boolean
})

const gameContainer = ref(null)

defineExpose({
  gameContainer
})

defineEmits(['run-game', 'stop-game', 'download-file'])
</script>


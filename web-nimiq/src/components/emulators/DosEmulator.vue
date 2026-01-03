<template>
  <div class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-white/10 dark:bg-gray-800/50 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10">
    <div class="px-4 py-5 sm:px-6 flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">DOS Emulator</h2>
      <!-- Action Buttons - Small Icon Buttons -->
      <div class="flex items-center gap-2">
        <!-- Toggle On-Screen Controls -->
        <button
          v-if="gameReady"
          @click="showControls = !showControls"
          :class="[
            'inline-flex items-center justify-center p-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500',
            showControls 
              ? 'border-yellow-500 text-yellow-400 bg-yellow-900/30' 
              : 'border-gray-600 text-gray-400 bg-transparent hover:bg-gray-700'
          ]"
          title="Toggle On-Screen Controls"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>
        
        <!-- Keyboard Shortcuts Help -->
        <KeyboardShortcutsHelp />
        
        <button
          v-if="!gameReady"
          @click="$emit('run-game')"
          :disabled="!verified || loading"
          class="inline-flex items-center justify-center p-2 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run Program"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div ref="gameContainer" class="bg-black rounded w-full mb-4" style="min-height: 520px; display: block;"></div>
      
      <!-- On-Screen Controls for DOOM -->
      <div v-if="gameReady && showControls" class="mt-4 select-none">
        <div class="flex flex-wrap justify-center items-center gap-4">
          
          <!-- D-Pad (Movement) -->
          <div class="flex flex-col items-center">
            <span class="text-xs text-gray-500 mb-2">MOVE</span>
            <div class="grid grid-cols-3 gap-1">
              <div></div>
              <button
                @pointerdown="pressKey('ArrowUp')"
                @pointerup="releaseKey('ArrowUp')"
                @pointerleave="releaseKey('ArrowUp')"
                class="touch-btn w-12 h-12 bg-gray-700 hover:bg-gray-600 active:bg-red-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                ▲
              </button>
              <div></div>
              <button
                @pointerdown="pressKey('ArrowLeft')"
                @pointerup="releaseKey('ArrowLeft')"
                @pointerleave="releaseKey('ArrowLeft')"
                class="touch-btn w-12 h-12 bg-gray-700 hover:bg-gray-600 active:bg-red-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                ◀
              </button>
              <button
                @pointerdown="pressKey('ArrowDown')"
                @pointerup="releaseKey('ArrowDown')"
                @pointerleave="releaseKey('ArrowDown')"
                class="touch-btn w-12 h-12 bg-gray-700 hover:bg-gray-600 active:bg-red-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                ▼
              </button>
              <button
                @pointerdown="pressKey('ArrowRight')"
                @pointerup="releaseKey('ArrowRight')"
                @pointerleave="releaseKey('ArrowRight')"
                class="touch-btn w-12 h-12 bg-gray-700 hover:bg-gray-600 active:bg-red-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                ▶
              </button>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs text-gray-500 mb-1">ACTIONS</span>
            <div class="flex gap-2">
              <!-- Shoot (Ctrl) -->
              <button
                @pointerdown="pressKey('Control')"
                @pointerup="releaseKey('Control')"
                @pointerleave="releaseKey('Control')"
                class="touch-btn w-16 h-14 bg-red-700 hover:bg-red-600 active:bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg"
              >
                🔫 FIRE
              </button>
              <!-- Use/Open (Space) -->
              <button
                @pointerdown="pressKey(' ')"
                @pointerup="releaseKey(' ')"
                @pointerleave="releaseKey(' ')"
                class="touch-btn w-16 h-14 bg-blue-700 hover:bg-blue-600 active:bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg"
              >
                🚪 USE
              </button>
            </div>
            <div class="flex gap-2">
              <!-- Run (Shift) -->
              <button
                @pointerdown="pressKey('Shift')"
                @pointerup="releaseKey('Shift')"
                @pointerleave="releaseKey('Shift')"
                class="touch-btn w-16 h-10 bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg"
              >
                🏃 RUN
              </button>
              <!-- Menu (Escape) -->
              <button
                @pointerdown="pressKey('Escape')"
                @pointerup="releaseKey('Escape')"
                @pointerleave="releaseKey('Escape')"
                class="touch-btn w-16 h-10 bg-gray-600 hover:bg-gray-500 active:bg-gray-400 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg"
              >
                ☰ ESC
              </button>
            </div>
          </div>
          
          <!-- Enter (for menus/confirm) -->
          <div class="flex flex-col items-center">
            <span class="text-xs text-gray-500 mb-2">CONFIRM</span>
            <button
              @pointerdown="pressKey('Enter')"
              @pointerup="releaseKey('Enter')"
              @pointerleave="releaseKey('Enter')"
              class="touch-btn w-20 h-12 bg-green-700 hover:bg-green-600 active:bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg"
            >
              ENTER
            </button>
          </div>
        </div>
        
        <p class="text-center text-xs text-gray-500 mt-3">
          Hold buttons for continuous input • Toggle with controller icon above
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp.vue'

const props = defineProps({
  verified: Boolean,
  loading: Boolean,
  gameReady: Boolean
})

const gameContainer = ref(null)
const showControls = ref(false)

// Track which keys are currently pressed (to prevent duplicate events)
const pressedKeys = new Set()

/**
 * Get the iframe inside the game container
 */
function getIframe() {
  if (!gameContainer.value) return null
  return gameContainer.value.querySelector('iframe')
}

/**
 * Send a keyboard event to the emulator iframe
 */
function sendKeyEvent(type, key) {
  const iframe = getIframe()
  if (!iframe) {
    console.warn('No iframe found for key event')
    return
  }
  
  // Map key names to keyCodes for DOSBox compatibility
  const keyCodeMap = {
    'ArrowUp': 38,
    'ArrowDown': 40,
    'ArrowLeft': 37,
    'ArrowRight': 39,
    'Control': 17,
    'Shift': 16,
    'Enter': 13,
    'Escape': 27,
    ' ': 32,  // Space
  }
  
  const keyCode = keyCodeMap[key] || key.charCodeAt(0)
  
  try {
    // Try to send to iframe's contentWindow
    const event = new KeyboardEvent(type, {
      key: key,
      code: key === ' ' ? 'Space' : key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    })
    
    // Try iframe's contentDocument first
    if (iframe.contentDocument) {
      iframe.contentDocument.dispatchEvent(event)
    }
    
    // Also dispatch to the iframe's contentWindow
    if (iframe.contentWindow) {
      iframe.contentWindow.dispatchEvent(event)
    }
    
    // Dispatch to the iframe element itself as fallback
    iframe.dispatchEvent(event)
    
  } catch (e) {
    // Cross-origin restriction - try postMessage as last resort
    console.warn('Could not dispatch key event directly:', e)
  }
}

/**
 * Handle key press (pointer down)
 */
function pressKey(key) {
  if (pressedKeys.has(key)) return
  pressedKeys.add(key)
  sendKeyEvent('keydown', key)
}

/**
 * Handle key release (pointer up)
 */
function releaseKey(key) {
  if (!pressedKeys.has(key)) return
  pressedKeys.delete(key)
  sendKeyEvent('keyup', key)
}

// Expose container ref to parent for DOS emulator initialization
defineExpose({
  gameContainer
})

defineEmits(['run-game', 'stop-game', 'download-file'])
</script>

<style scoped>
/* Touch-friendly button styles */
.touch-btn {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.touch-btn:active {
  transform: scale(0.95);
}
</style>

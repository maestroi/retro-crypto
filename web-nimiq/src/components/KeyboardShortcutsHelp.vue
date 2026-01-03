<template>
  <div class="relative">
    <!-- Help Button -->
    <button
      @click="showHelp = !showHelp"
      class="p-2 text-gray-400 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-700/50"
      title="Keyboard Shortcuts"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    </button>
    
    <!-- Shortcuts Panel -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showHelp"
        class="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 z-50"
      >
        <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Keyboard Shortcuts
        </h3>
        
        <div class="space-y-2">
          <div v-for="shortcut in shortcuts" :key="shortcut.key" class="flex items-center justify-between">
            <span class="text-xs text-gray-400">{{ shortcut.description }}</span>
            <kbd class="px-2 py-0.5 text-xs font-mono bg-gray-700 text-gray-300 rounded border border-gray-600">
              {{ shortcut.display || shortcut.key }}
            </kbd>
          </div>
        </div>
        
        <div class="mt-3 pt-3 border-t border-gray-700">
          <p class="text-xs text-gray-500">
            Shortcuts work when emulator is focused
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showHelp = ref(false)

const shortcuts = [
  { key: 'F11', description: 'Fullscreen' },
  { key: 'Escape', description: 'Exit Fullscreen', display: 'Esc' },
  { key: 'Ctrl+R', description: 'Reset Game' },
  { key: 'P', description: 'Pause/Resume' },
  { key: 'F5', description: 'Save State' },
  { key: 'F9', description: 'Load State' },
  { key: 'M', description: 'Mute/Unmute' },
]

// Close on click outside
function handleClickOutside(event) {
  if (showHelp.value && !event.target.closest('.relative')) {
    showHelp.value = false
  }
}
</script>


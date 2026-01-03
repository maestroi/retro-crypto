<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div v-if="isOpen" class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700/50">
          <!-- Decorative background -->
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none"></div>
          <div class="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <!-- Content -->
          <div class="relative px-6 py-8 sm:px-8">
            <!-- Header with retro icon -->
            <div class="flex items-center gap-4 mb-6">
              <div class="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-bold text-white">Nimiq Retro Games</h2>
                <p class="text-amber-400 text-sm font-medium">Games preserved on the blockchain</p>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-4 mb-8">
              <p class="text-gray-300 leading-relaxed">
                Welcome! This app lets you play classic retro games that are permanently stored on the 
                <span class="text-amber-400 font-medium">Nimiq blockchain</span>. No servers needed – 
                the games are reconstructed directly from blockchain transactions.
              </p>
              
              <!-- Features list -->
              <div class="grid gap-3">
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <p class="text-sm text-gray-400">
                    <span class="text-gray-200 font-medium">Decentralized</span> – Games live forever on-chain, no takedowns
                  </p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <p class="text-sm text-gray-400">
                    <span class="text-gray-200 font-medium">Verified</span> – SHA256 hash ensures authentic game files
                  </p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <p class="text-sm text-gray-400">
                    <span class="text-gray-200 font-medium">Multiple platforms</span> – DOS, NES, Game Boy supported
                  </p>
                </div>
              </div>
            </div>

            <!-- How to use -->
            <div class="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700/50">
              <h3 class="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Start
              </h3>
              <ol class="text-sm text-gray-400 space-y-2">
                <li class="flex gap-2">
                  <span class="text-amber-400 font-mono">1.</span>
                  Select a game from the dropdown menu
                </li>
                <li class="flex gap-2">
                  <span class="text-amber-400 font-mono">2.</span>
                  Wait for blockchain download & verification
                </li>
                <li class="flex gap-2">
                  <span class="text-amber-400 font-mono">3.</span>
                  Game starts automatically – enjoy!
                </li>
              </ol>
            </div>

            <!-- Advanced Settings (Expandable) -->
            <div class="mb-6">
              <button 
                @click="showAdvanced = !showAdvanced"
                class="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors w-full"
              >
                <svg 
                  class="w-4 h-4 transition-transform duration-200" 
                  :class="{ 'rotate-90': showAdvanced }"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span class="font-medium">Advanced Settings</span>
                <span class="text-xs text-gray-500">(RPC & Catalogs)</span>
              </button>
              
              <Transition
                enter-active-class="transition ease-out duration-200"
                enter-from-class="opacity-0 -translate-y-2 max-h-0"
                enter-to-class="opacity-100 translate-y-0 max-h-96"
                leave-active-class="transition ease-in duration-150"
                leave-from-class="opacity-100 translate-y-0 max-h-96"
                leave-to-class="opacity-0 -translate-y-2 max-h-0"
              >
                <div v-if="showAdvanced" class="mt-4 space-y-4 overflow-hidden">
                  <!-- RPC Servers -->
                  <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                      <h4 class="text-sm font-semibold text-gray-200">RPC Server</h4>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      The <span class="text-blue-300">RPC endpoint</span> connects to the Nimiq blockchain to fetch game data. 
                      By default, we use <span class="text-gray-300 font-mono text-[10px]">rpc-mainnet.nimiqscan.com</span>.
                    </p>
                    <p class="text-xs text-gray-500 mt-2">
                      💡 You can use any Nimiq RPC server, including your own node for maximum decentralization.
                    </p>
                  </div>
                  
                  <!-- Catalogs -->
                  <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h4 class="text-sm font-semibold text-gray-200">Game Catalog</h4>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      A <span class="text-purple-300">catalog</span> is a Nimiq address that indexes available games. 
                      It contains entries (CENT transactions) pointing to game cartridges stored on-chain.
                    </p>
                    <p class="text-xs text-gray-500 mt-2">
                      💡 Anyone can create their own catalog! Just upload games using the uploader tool and share your catalog address.
                    </p>
                  </div>
                  
                  <!-- How data is stored -->
                  <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      <h4 class="text-sm font-semibold text-gray-200">On-Chain Storage</h4>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      Games are split into <span class="text-emerald-300">64-byte chunks</span> stored as transaction data. 
                      Each game has a CART header with metadata + SHA256 hash, and DATA transactions with the actual file bytes.
                    </p>
                    <div class="flex gap-2 mt-2 text-[10px] font-mono">
                      <span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">CART</span>
                      <span class="text-gray-500">→</span>
                      <span class="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">DATA × N</span>
                      <span class="text-gray-500">→</span>
                      <span class="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">CENT</span>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Keyboard shortcuts hint -->
            <div class="flex items-center gap-2 text-xs text-gray-500 mb-6">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Press <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">F11</kbd> for fullscreen, <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">Ctrl+R</kbd> to reset</span>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="startPlaying"
                class="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-orange-400 transition-all duration-200 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Start Playing
              </button>
              <button
                @click="dismiss"
                class="px-5 py-3 rounded-xl bg-gray-700/50 text-gray-300 font-medium hover:bg-gray-700 hover:text-white transition-colors border border-gray-600/50"
              >
                Don't show again
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'nimiq-games-welcome-dismissed'

const isOpen = ref(false)
const showAdvanced = ref(false)

const emit = defineEmits(['close'])

onMounted(() => {
  // Check if user has dismissed the modal before
  const dismissed = localStorage.getItem(STORAGE_KEY)
  if (!dismissed) {
    // Small delay for better UX
    setTimeout(() => {
      isOpen.value = true
    }, 500)
  }
})

function startPlaying() {
  isOpen.value = false
  emit('close')
}

function dismiss() {
  localStorage.setItem(STORAGE_KEY, 'true')
  isOpen.value = false
  emit('close')
}

// Expose method to show modal again (e.g., from help button)
function show() {
  isOpen.value = true
}

defineExpose({ show })
</script>


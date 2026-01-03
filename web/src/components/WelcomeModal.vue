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
            <div class="flex items-center gap-4 mb-4">
              <div class="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-bold text-white">Retro Crypto</h2>
              </div>
            </div>
            
            <!-- Tagline -->
            <p class="text-amber-400 text-base font-medium mb-6">
              Download retro games from the blockchain and play them in your browser!
            </p>

            <!-- Description -->
            <div class="space-y-4 mb-8">
              <p class="text-gray-300 leading-relaxed">
                Welcome! This app lets you play classic retro games that are permanently stored on 
                <span class="text-amber-400 font-medium">multiple blockchains</span>. No servers needed – 
                the games are reconstructed directly from blockchain data.
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
                    <span class="text-gray-200 font-medium">Multi-Chain</span> – Supports Nimiq, Solana, and more
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
                  Choose your blockchain (Nimiq or Solana)
                </li>
                <li class="flex gap-2">
                  <span class="text-amber-400 font-mono">2.</span>
                  Select a game from the catalog
                </li>
                <li class="flex gap-2">
                  <span class="text-amber-400 font-mono">3.</span>
                  Wait for download & verification – then play!
                </li>
              </ol>
            </div>

            <!-- Keyboard shortcuts hint -->
            <div class="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Press <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">F11</kbd> for fullscreen, <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">Ctrl+R</kbd> to reset</span>
            </div>

            <!-- Legal Disclaimer -->
            <div class="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 mb-4">
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <div class="text-[10px] text-gray-500 leading-relaxed">
                  <p class="font-medium text-gray-400 mb-1">Legal Disclaimer</p>
                  <p>
                    This project is for <span class="text-gray-400">educational and research purposes only</span>. 
                    Users are responsible for ensuring they have the legal right to use any game files. 
                    Only use games you legally own or that are in the public domain. 
                    The developers do not condone piracy and are not responsible for any misuse of this software.
                    This software is provided "as is" without warranty of any kind.
                  </p>
                </div>
              </div>
            </div>

            <!-- Disclaimer Acceptance Checkbox -->
            <div class="mb-6">
              <label class="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  v-model="disclaimerAccepted"
                  class="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-2 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer"
                />
                <span class="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  I understand and accept the legal disclaimer above
                </span>
              </label>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="startPlaying"
                :disabled="!disclaimerAccepted"
                :class="[
                  'flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-200',
                  disclaimerAccepted
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                    : 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-60'
                ]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                Let's Play!
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

const STORAGE_KEY_DISMISSED = 'retro-crypto-welcome-dismissed'
const STORAGE_KEY_ACCEPTED = 'retro-crypto-disclaimer-accepted'

const isOpen = ref(false)
const disclaimerAccepted = ref(false)

const emit = defineEmits(['close'])

onMounted(() => {
  // Check if user has dismissed the modal or accepted disclaimer before
  const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED)
  const accepted = localStorage.getItem(STORAGE_KEY_ACCEPTED)
  
  if (accepted) {
    disclaimerAccepted.value = true
  }
  
  if (!dismissed) {
    // Small delay for better UX
    setTimeout(() => {
      isOpen.value = true
    }, 500)
  }
})

function startPlaying() {
  // Save disclaimer acceptance
  if (disclaimerAccepted.value) {
    localStorage.setItem(STORAGE_KEY_ACCEPTED, 'true')
  }
  isOpen.value = false
  emit('close')
}

function dismiss() {
  localStorage.setItem(STORAGE_KEY_DISMISSED, 'true')
  // Save disclaimer acceptance
  if (disclaimerAccepted.value) {
    localStorage.setItem(STORAGE_KEY_ACCEPTED, 'true')
  }
  isOpen.value = false
  emit('close')
}

// Expose method to show modal again (e.g., from help button)
function show() {
  isOpen.value = true
}

defineExpose({ show })
</script>


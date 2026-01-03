<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Transition
        enter-active-class="transition ease-out duration-300"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div v-if="isOpen" class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50">
          <!-- Decorative background -->
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none"></div>
          <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <!-- Content -->
          <div class="relative px-6 py-8 sm:px-8">
            <!-- Header with retro icon -->
            <div class="flex items-center gap-4 mb-6">
              <div class="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 shadow-lg shadow-purple-500/25">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-bold text-white">Solana Retro</h2>
                <p class="text-purple-400 text-sm font-medium">Classic games on the blockchain</p>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-4 mb-6">
              <p class="text-gray-300 leading-relaxed">
                Welcome! This experimental app lets you play retro games stored entirely on the 
                <span class="text-purple-400 font-medium">Solana blockchain</span>. Game files are 
                reconstructed from on-chain account data – no central servers required.
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
                    <span class="text-gray-200 font-medium">Permanent Storage</span> – Games live on-chain as long as rent is paid
                  </p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <p class="text-sm text-gray-400">
                    <span class="text-gray-200 font-medium">Verified</span> – SHA256 hash ensures authentic, unmodified game files
                  </p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <p class="text-sm text-gray-400">
                    <span class="text-gray-200 font-medium">Multiple Platforms</span> – DOS, NES, Game Boy & Game Boy Color
                  </p>
                </div>
              </div>
            </div>

            <!-- Cost Warning -->
            <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mt-0.5">
                  <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-amber-300 font-semibold text-sm mb-1">Experimental Project</h3>
                  <p class="text-amber-200/70 text-xs leading-relaxed">
                    This is a proof-of-concept. Storing games on Solana is <span class="text-amber-300 font-medium">expensive</span> – 
                    uploading a 1MB game costs ~6.9 SOL in rent. This project explores what's possible, 
                    not what's practical. Currently running on <span class="text-amber-300">Testnet</span>.
                  </p>
                </div>
              </div>
            </div>

            <!-- How to use -->
            <div class="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
              <h3 class="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Start
              </h3>
              <ol class="text-sm text-gray-400 space-y-2">
                <li class="flex gap-2">
                  <span class="text-cyan-400 font-mono">1.</span>
                  Select a game from the catalog dropdown
                </li>
                <li class="flex gap-2">
                  <span class="text-cyan-400 font-mono">2.</span>
                  Wait for download from blockchain & verification
                </li>
                <li class="flex gap-2">
                  <span class="text-cyan-400 font-mono">3.</span>
                  Click "Run" to start playing!
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
                <span class="font-medium">How It Works</span>
                <span class="text-xs text-gray-500">(Technical Details)</span>
              </button>
              
              <Transition
                enter-active-class="transition ease-out duration-200"
                enter-from-class="opacity-0 -translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition ease-in duration-150"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-2"
              >
                <div v-if="showAdvanced" class="mt-4 space-y-4 overflow-hidden">
                  <!-- On-chain Storage -->
                  <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      <h4 class="text-sm font-semibold text-gray-200">Solana Account Storage</h4>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      Games are stored using Solana's <span class="text-purple-300">Program Derived Addresses (PDAs)</span>. 
                      Each game has a <span class="text-gray-300">Manifest</span> account with metadata and is split 
                      into ~900-byte <span class="text-gray-300">Chunk</span> accounts.
                    </p>
                    <div class="flex gap-2 mt-3 text-[10px] font-mono flex-wrap">
                      <span class="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">Catalog</span>
                      <span class="text-gray-500">→</span>
                      <span class="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded">Manifest</span>
                      <span class="text-gray-500">→</span>
                      <span class="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded">Chunks × N</span>
                    </div>
                  </div>
                  
                  <!-- RPC & Caching -->
                  <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                      <h4 class="text-sm font-semibold text-gray-200">RPC & Caching</h4>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      Game data is fetched via <span class="text-cyan-300">Solana RPC</span> endpoints. 
                      Large games are downloaded in parallel batches. Downloaded chunks are 
                      <span class="text-gray-300">cached locally</span> in IndexedDB – subsequent loads are instant!
                    </p>
                    <p class="text-xs text-gray-500 mt-2">
                      💡 First load may take a minute for large games. After that, it's instant from cache.
                    </p>
                  </div>
                  
                  <!-- Cost breakdown -->
                  <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 class="text-sm font-semibold text-gray-200">Why Is It Expensive?</h4>
                    </div>
                    <p class="text-xs text-gray-400 leading-relaxed">
                      Solana charges <span class="text-amber-300">rent</span> for account storage (~0.00696 SOL per KB). 
                      A 1MB game needs ~1,100 chunk accounts = ~6.9 SOL ($1,000+ at current prices). 
                      This makes Solana unsuitable for large-scale game storage, but perfect for this experiment!
                    </p>
                  </div>
                </div>
              </Transition>
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
                  class="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-2 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer"
                />
                <span class="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  I understand and accept the legal disclaimer above
                </span>
              </label>
            </div>

            <!-- Links -->
            <div class="flex items-center gap-4 text-xs text-gray-500 mb-6">
              <a href="https://github.com/maestroi/solana-retro" target="_blank" class="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
                </svg>
                GitHub
              </a>
              <span class="text-gray-600">•</span>
              <span class="text-gray-400">Running on Solana Testnet</span>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="startPlaying"
                :disabled="!disclaimerAccepted"
                :class="[
                  'flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-200',
                  disclaimerAccepted
                    ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/25 hover:from-purple-400 hover:to-cyan-400 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
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
                class="px-5 py-3 rounded-xl bg-slate-700/50 text-gray-300 font-medium hover:bg-slate-700 hover:text-white transition-colors border border-slate-600/50"
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

const STORAGE_KEY_DISMISSED = 'solana-retro-welcome-dismissed'
const STORAGE_KEY_ACCEPTED = 'solana-retro-disclaimer-accepted'

const isOpen = ref(false)
const showAdvanced = ref(false)
const disclaimerAccepted = ref(false)

const emit = defineEmits(['close'])

onMounted(() => {
  // Check if user has dismissed the modal or accepted disclaimer before
  const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED)
  const accepted = localStorage.getItem(STORAGE_KEY_ACCEPTED)
  
  // Restore acceptance state if previously accepted
  if (accepted === 'true') {
    disclaimerAccepted.value = true
  }
  
  // Only show modal if not dismissed and not accepted
  if (!dismissed && !accepted) {
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
  isOpen.value = false
  emit('close')
}

// Expose method to show modal again (e.g., from help button)
function show() {
  isOpen.value = true
}

defineExpose({ show })
</script>


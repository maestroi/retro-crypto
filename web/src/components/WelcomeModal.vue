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
                    <span class="text-gray-200 font-medium">Multi-Chain</span> – Supports Nimiq, Solana, Sui, and more
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
            <div class="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
              <h3 class="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Start
              </h3>
              <ol class="text-sm text-gray-400 space-y-2">
                <li class="flex gap-2">
                  <span class="text-amber-400 font-mono">1.</span>
                  Choose your blockchain (Nimiq, Solana, or Sui)
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

            <!-- How Each Chain Works -->
            <div class="mb-4">
              <button 
                @click="showChainInfo = !showChainInfo"
                class="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:bg-gray-800 transition-colors"
              >
                <span class="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  How Each Blockchain Works
                </span>
                <svg 
                  class="w-4 h-4 text-gray-400 transition-transform duration-200" 
                  :class="{ 'rotate-180': showChainInfo }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <Transition
                enter-active-class="transition ease-out duration-200"
                enter-from-class="opacity-0 -translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition ease-in duration-150"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-2"
              >
                <div v-if="showChainInfo" class="mt-3 space-y-3">
                  <!-- Nimiq -->
                  <div class="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-lg">🟡</span>
                      <h4 class="text-sm font-semibold text-yellow-400">Nimiq</h4>
                    </div>
                    <div class="text-xs text-gray-400 leading-relaxed space-y-1.5">
                      <p>
                        <span class="text-yellow-300 font-medium">Transaction-based storage</span> – Games are stored in transaction payloads on Nimiq's blockchain.
                      </p>
                      <p>
                        Each game uses three payload types: <code class="px-1 py-0.5 bg-gray-800 rounded text-yellow-300">CART</code> (header with SHA256 hash), 
                        <code class="px-1 py-0.5 bg-gray-800 rounded text-yellow-300">DATA</code> (file chunks ~51 bytes each), and 
                        <code class="px-1 py-0.5 bg-gray-800 rounded text-yellow-300">CENT</code> (catalog entries).
                      </p>
                      <p>
                        <span class="text-gray-300">Cost:</span> 64 bytes per 1 Luna. A 1MB game costs ~0.16 NIM
                        <span v-if="nimiqUsdPrice" class="text-gray-500">(~${{ formatUsdPrice(0.16 * nimiqUsdPrice) }})</span>
                        <span v-else class="text-gray-500">(fraction of a cent!)</span>.
                      </p>
                    </div>
                  </div>
                  
                  <!-- Solana -->
                  <div class="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-lg">🟣</span>
                      <h4 class="text-sm font-semibold text-purple-400">Solana</h4>
                    </div>
                    <div class="text-xs text-gray-400 leading-relaxed space-y-1.5">
                      <p>
                        <span class="text-purple-300 font-medium">Account-based storage</span> – Games are stored in Program Derived Addresses (PDAs) controlled by a smart contract.
                      </p>
                      <p>
                        Uses separate accounts for: <code class="px-1 py-0.5 bg-gray-800 rounded text-purple-300">Catalog</code> (game listings), 
                        <code class="px-1 py-0.5 bg-gray-800 rounded text-purple-300">Manifest</code> (game metadata), and 
                        <code class="px-1 py-0.5 bg-gray-800 rounded text-purple-300">Chunks</code> (file data ~900 bytes each).
                      </p>
                      <p>
                        <span class="text-gray-300">Cost:</span> ~0.00696 SOL per KB (rent-exempt). A 1MB game costs ~7 SOL (~$1,000+). Experimental only!
                      </p>
                    </div>
                  </div>
                  
                  <!-- Sui + Walrus -->
                  <div class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-lg">🔵</span>
                      <h4 class="text-sm font-semibold text-blue-400">Sui + Walrus</h4>
                    </div>
                    <div class="text-xs text-gray-400 leading-relaxed space-y-1.5">
                      <p>
                        <span class="text-blue-300 font-medium">Hybrid storage</span> – Game metadata stored on Sui blockchain, game files stored on Walrus decentralized blob storage.
                      </p>
                      <p>
                        Sui stores: <code class="px-1 py-0.5 bg-gray-800 rounded text-blue-300">Catalog</code> (curated game lists as shared objects), 
                        <code class="px-1 py-0.5 bg-gray-800 rounded text-blue-300">Cartridge</code> (game metadata with Walrus blob ID), and 
                        <code class="px-1 py-0.5 bg-gray-800 rounded text-blue-300">Dynamic Fields</code> (catalog entries).
                      </p>
                      <p>
                        Walrus stores: <code class="px-1 py-0.5 bg-gray-800 rounded text-blue-300">ZIP blobs</code> (one blob per game, content-addressed). Games are downloaded from Walrus and verified using SHA256.
                      </p>
                      <p>
                        <span class="text-gray-300">Cost:</span> Creating a cartridge costs ~0.02-0.05 SUI (gas), adding to catalog ~0.01-0.02 SUI. A typical cartridge costs ~0.03-0.07 SUI total. Walrus blob storage is decentralized and cost-effective for large files.
                      </p>
                    </div>
                  </div>
                </div>
              </Transition>
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
const showChainInfo = ref(false)
const nimiqUsdPrice = ref(null)

const emit = defineEmits(['close'])

// Fetch Nimiq USD price from CoinGecko
async function fetchNimiqPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq&vs_currencies=usd')
    const data = await response.json()
    if (data.nimiq && data.nimiq.usd) {
      nimiqUsdPrice.value = data.nimiq.usd
    }
  } catch (error) {
    console.warn('Failed to fetch Nimiq price:', error)
    // Silently fail - price is optional
  }
}

// Format USD price
function formatUsdPrice(usdValue) {
  if (usdValue >= 0.01) {
    return usdValue.toFixed(4)
  } else {
    return usdValue.toFixed(6)
  }
}

onMounted(() => {
  // Fetch Nimiq price when modal opens
  fetchNimiqPrice()
  
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
  // Refresh price when showing modal
  if (!nimiqUsdPrice.value) {
    fetchNimiqPrice()
  }
  isOpen.value = true
}

defineExpose({ show })
</script>


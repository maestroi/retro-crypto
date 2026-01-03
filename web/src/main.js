// Polyfills for @solana/web3.js in browser environment
import { Buffer } from 'buffer'
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
  window.global = window
}
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer
}

import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')


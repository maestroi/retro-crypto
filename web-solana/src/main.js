// Polyfills for Solana web3.js (must be first)
import './polyfills.js'

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')

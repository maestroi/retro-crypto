/**
 * Polyfills for @solana/web3.js in browser environment
 */

import { Buffer } from 'buffer'

// Make Buffer available globally
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
  window.global = window
}

if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer
}


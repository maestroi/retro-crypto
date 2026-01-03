import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  base: process.env.GITHUB_PAGES ? '/retro-crypto/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  publicDir: 'public',
  // Polyfills for @solana/web3.js in browser
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: ['buffer', '@solana/web3.js'],
  },
})


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
    proxy: {
      // Proxy Sui RPC requests to avoid CORS issues
      '/sui-rpc': {
        target: 'https://fullnode.testnet.sui.io:443',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sui-rpc/, ''),
        secure: true,
      },
    },
  },
  // SPA fallback for routing - serve index.html for all routes
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
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


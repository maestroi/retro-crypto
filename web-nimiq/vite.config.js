import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // PWA plugin temporarily disabled due to vite 7 compatibility
    // TODO: Re-enable when vite-plugin-pwa supports vite 7
  ],
  base: process.env.GITHUB_PAGES ? '/nimiq-doom/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  // Enable public directory for PWA assets
  publicDir: 'public',
})

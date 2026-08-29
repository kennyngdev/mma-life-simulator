import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sites } from '@openai/sites-vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, '.', '').VITE_BASE_PATH || '/',
  plugins: [
    react(),
    sites(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['cage-mark.svg'],
      manifest: {
        name: '拳途人生 Cage Life',
        short_name: '拳途人生',
        description: '拳途人生 Cage Life：一名綜合格鬥拳手從無名到退役的完整人生。',
        theme_color: '#12110f',
        background_color: '#12110f',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [{ src: 'cage-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}']
      }
    })
  ],
  build: {
    outDir: 'dist/client'
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts']
  }
}))

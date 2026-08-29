import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable, and nothing more: the shell is precached so the app opens
    // from the home screen without a network round trip, but no data is cached
    // — a budget shown from a stale cache would be worse than no budget at
    // all. Offline is a v2 subject (specs §2.3).
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // PocketBase serves the SPA, its REST API and its admin console on one
        // origin. Without these exclusions the navigation fallback answers
        // /_/ with the precached shell, and the admin console becomes
        // unreachable from any browser that has opened the app once.
        navigateFallbackDenylist: [/^\/api\//u, /^\/_\//u],
      },
      manifest: {
        name: 'Budget',
        short_name: 'Budget',
        description: 'Suivi de budget personnel en francs CFA',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0f172a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // The service worker must not exist during the journeys: it would serve
      // one test's build to the next and there is nothing to gain from it.
      disable: process.env['VITEST'] === 'true',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../pb_public',
    emptyOutDir: true,
  },
  test: {
    name: 'journeys',
    include: ['src/**/*.journey.{ts,tsx}'],
    // One journey file at a time. In parallel they run as same-origin iframes,
    // so they share localStorage — and PocketBase's LocalAuthStore listens for
    // the storage event to follow sign-ins made in other tabs. A sign-in in one
    // file then lands in another file's client, which showed up as an isolation
    // test failing about once in six runs. Measured: 8 runs green serialised,
    // for roughly 20 extra seconds. The cross-tab sync is a feature the app
    // relies on, so it is the parallelism that gives way, not the store.
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})

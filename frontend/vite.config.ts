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
        // woff2 is in the list because the fonts are served from this origin:
        // a precached shell that opened offline in the system font would look
        // like a different application.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        // PocketBase serves the SPA, its REST API and its admin console on one
        // origin. Without these exclusions the navigation fallback answers
        // /_/ with the precached shell, and the admin console becomes
        // unreachable from any browser that has opened the app once.
        navigateFallbackDenylist: [/^\/api\//u, /^\/_\//u],
      },
      manifest: {
        name: 'Kalpe',
        short_name: 'Kalpe',
        description: 'Suivi de budget personnel en francs CFA',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        // background_color is the splash: the light page. theme_color is the
        // chrome, and the rule is the one index.html states — it matches the
        // top of the page, which is the app bar, which is --k-surface. A
        // manifest holds one value, so it holds the light one; the two
        // media-scoped metas take over per theme once the page has loaded.
        // These were the accent for one commit, which put a brown title bar
        // on an installed app whose tab was white.
        background_color: '#faf7f2',
        theme_color: '#ffffff',
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

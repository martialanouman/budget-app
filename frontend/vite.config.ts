import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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

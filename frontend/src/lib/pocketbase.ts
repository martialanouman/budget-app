import PocketBase from 'pocketbase'

// In production PocketBase serves the SPA itself, so a relative base URL keeps
// the app on a single origin. Development points at the standalone server.
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? '/')

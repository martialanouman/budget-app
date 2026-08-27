import PocketBase from 'pocketbase'

// In production PocketBase serves the SPA itself, so a relative base URL keeps
// the app on a single origin. Development points at the standalone server.
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? '/')

// The SDK cancels any in-flight request as soon as another one leaves for the
// same method and path, unless a request key says otherwise. Two callers that
// merely read the same collection at the same moment — a list on screen and
// the lookup a mutation performs before writing — then abort each other, and
// the loser keeps showing data from before the write. TanStack Query already
// owns deduplication and cancellation here, so this second, path-based layer
// only produces heisenbugs.
pb.autoCancellation(false)

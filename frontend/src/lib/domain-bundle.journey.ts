import { expect, it } from 'vitest'
import { pb } from '@/lib/pocketbase'

type DomainProbe = { parts: number[]; parsed: number; sum: number }

// The shared domain is bundled to CommonJS and executed by PocketBase's goja
// engine, which is neither node nor a browser. This asks a PocketBase route for
// values only the bundle can produce, so the whole chain is proven rather than
// assumed: esbuild output, require through __hooks, and goja running the code.
it('runs the shared domain bundle inside the PocketBase engine', async () => {
  const probe = await pb.send<DomainProbe>('/api/_test/domain', { method: 'GET' })

  expect(probe.parts).toEqual([34, 33, 33])
  expect(probe.parsed).toBe(150_000)
  expect(probe.sum).toBe(2_500)
})

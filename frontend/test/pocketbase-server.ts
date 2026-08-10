import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = 8091
const STARTUP_TIMEOUT_MS = 20_000

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

async function waitUntilHealthy() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${HOST}:${PORT}/api/health`)
      if (response.ok) return
    } catch {
      // Server not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`PocketBase did not become healthy within ${STARTUP_TIMEOUT_MS}ms`)
}

export default async function setup() {
  const dataDir = await mkdtemp(join(tmpdir(), 'budget-pb-'))

  const server = spawn(
    join(repoRoot, 'bin', 'pocketbase'),
    [
      'serve',
      `--http=${HOST}:${PORT}`,
      `--dir=${dataDir}`,
      `--migrationsDir=${join(repoRoot, 'pb_migrations')}`,
    ],
    { stdio: 'ignore' },
  )

  server.on('error', (error) => {
    throw new Error(`Failed to start PocketBase: ${error.message}. Run "pnpm pb:install" first.`)
  })

  await waitUntilHealthy()

  return async () => {
    server.kill()
    await rm(dataDir, { recursive: true, force: true })
  }
}

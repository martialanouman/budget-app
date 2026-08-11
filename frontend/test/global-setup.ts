import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const HOST = '127.0.0.1'
const POCKETBASE_PORT = 8091
const MAILPIT_HTTP_PORT = 8026
const MAILPIT_SMTP_PORT = 1026
const STARTUP_TIMEOUT_MS = 20_000

const POCKETBASE_URL = `http://${HOST}:${POCKETBASE_PORT}`
const MAILPIT_URL = `http://${HOST}:${MAILPIT_HTTP_PORT}`

const SUPERUSER_EMAIL = 'harness@example.com'
const SUPERUSER_PASSWORD = 'harness-password'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const binary = (name: string) => join(repoRoot, 'bin', name)

async function waitUntilReachable(url: string, label: string) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(
    `${label} did not become reachable within ${STARTUP_TIMEOUT_MS}ms. ` +
      'Check that "pnpm services:install" has run and that the port is free.',
  )
}

// SIGTERM only asks: PocketBase still has to flush its SQLite WAL into the data
// directory, so wait for the exit before deleting it.
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = once(child, 'exit')
  child.kill()
  await exited
}

// PocketBase keeps SMTP settings in the database, so they cannot be passed as
// flags: authenticate as superuser and patch them once the server is up.
async function pointPocketBaseAtMailpit() {
  const auth = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD }),
  })

  if (!auth.ok) throw new Error(`Superuser authentication failed: ${await auth.text()}`)

  const { token } = (await auth.json()) as { token: string }

  const settings = await fetch(`${POCKETBASE_URL}/api/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({
      meta: {
        appName: 'Budget',
        appUrl: POCKETBASE_URL,
        senderName: 'Budget',
        senderAddress: 'no-reply@budget.test',
      },
      smtp: {
        enabled: true,
        host: HOST,
        port: MAILPIT_SMTP_PORT,
        tls: false,
        authMethod: 'PLAIN',
        username: 'harness',
        password: 'harness',
      },
    }),
  })

  if (!settings.ok) throw new Error(`Failed to configure SMTP: ${await settings.text()}`)
}

export default async function setup() {
  const dataDir = await mkdtemp(join(tmpdir(), 'budget-pb-'))

  await run(binary('pocketbase'), [
    'superuser',
    'upsert',
    SUPERUSER_EMAIL,
    SUPERUSER_PASSWORD,
    `--dir=${dataDir}`,
  ])

  const mailpit = spawn(
    binary('mailpit'),
    [
      `--listen=${HOST}:${MAILPIT_HTTP_PORT}`,
      `--smtp=${HOST}:${MAILPIT_SMTP_PORT}`,
      '--smtp-auth-accept-any',
      '--smtp-auth-allow-insecure',
      '--api-cors=*',
    ],
    { stdio: 'ignore' },
  )

  const pocketbase = spawn(
    binary('pocketbase'),
    [
      'serve',
      `--http=${HOST}:${POCKETBASE_PORT}`,
      `--dir=${dataDir}`,
      `--migrationsDir=${join(repoRoot, 'pb_migrations')}`,
    ],
    { stdio: 'ignore' },
  )

  const teardown = async () => {
    await stop(pocketbase)
    await stop(mailpit)
    await rm(dataDir, { recursive: true, force: true })
  }

  // Anything past this point can throw, and Vitest only receives the teardown
  // closure on success: clean up here or the children outlive the failed run.
  try {
    await waitUntilReachable(`${MAILPIT_URL}/readyz`, 'Mailpit')
    await waitUntilReachable(`${POCKETBASE_URL}/api/health`, 'PocketBase')
    await pointPocketBaseAtMailpit()
  } catch (error) {
    await teardown()
    throw error
  }

  return teardown
}

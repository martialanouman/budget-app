import { beforeEach, expect, it } from 'vitest'
import { PASSWORD, createSignedInUser, uniqueEmail } from '../../test/journey-harness.tsx'
import {
  changePassword,
  confirmEmailChange,
  disableSecondFactor,
  enableSecondFactor,
  requestEmailChange,
} from './auth.ts'
import { pb } from '@/lib/pocketbase'

const MAILPIT_URL = import.meta.env.VITE_MAILPIT_URL ?? 'http://127.0.0.1:8026'
const MAIL_TIMEOUT_MS = 10_000
const NEW_PASSWORD = 'nouveau-mot-de-passe'

/**
 * The confirmation link, read from the inbox of the address it was sent to.
 *
 * Filtered by subject rather than by recipient alone: `authAlert` is on and
 * sends its own mail, so taking whichever message arrived first would pick the
 * wrong one about as often as not.
 */
async function waitForChangeLink(recipient: string) {
  const deadline = Date.now() + MAIL_TIMEOUT_MS
  const query = `to:${recipient} subject:"nouvelle adresse"`

  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }

    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0]!.ID}`)
      const { HTML } = (await message.json()) as { HTML: string }
      const link = /href="([^"]+)"/u.exec(HTML)

      if (link) return link[1]!
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error(`No address-change email reached ${recipient} within ${MAIL_TIMEOUT_MS}ms`)
}

const signsInWith = (email: string, password: string) =>
  pb
    .collection('users')
    .authWithPassword(email, password)
    .then(() => true)
    .catch(() => false)

beforeEach(() => {
  pb.authStore.clear()
})

it('changes a password and leaves the owner signed in', async () => {
  const email = await createSignedInUser('cred')

  await changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

  // Still in. PocketBase rotates the tokenKey on a password change, so the
  // session this was done from is dead server-side; being thrown back to the
  // sign-in screen for having done an ordinary thing correctly is what the
  // re-authentication avoids.
  expect(pb.authStore.isValid).toBe(true)

  pb.authStore.clear()
  expect(await signsInWith(email, NEW_PASSWORD)).toBe(true)
  pb.authStore.clear()
  expect(await signsInWith(email, PASSWORD)).toBe(false)
})

// The old password is demanded by PocketBase itself, not only by the form. A
// screen that asked for it while the server did not would be a formality that
// anyone reaching the API could skip.
it('refuses a password change without the current password', async () => {
  const email = await createSignedInUser('cred')

  await expect(changePassword('mauvais-mot-de-passe', NEW_PASSWORD, NEW_PASSWORD)).rejects.toThrow()

  pb.authStore.clear()
  expect(await signsInWith(email, PASSWORD)).toBe(true)
})

/**
 * The property that matters is not that the address changes, but that it does
 * not change until the new address has answered. Asserting only the end state
 * would pass just as well on an implementation that switched immediately and
 * mailed a link nobody had to click.
 */
it('moves the address only once the new one has confirmed', async () => {
  const email = await createSignedInUser('cred')
  const wanted = uniqueEmail('moved')

  await requestEmailChange(wanted)

  // Nothing yet: the old address still authenticates, the new one does not.
  pb.authStore.clear()
  expect(await signsInWith(email, PASSWORD)).toBe(true)
  pb.authStore.clear()
  expect(await signsInWith(wanted, PASSWORD)).toBe(false)

  const link = await waitForChangeLink(wanted)
  const token = new URL(link).searchParams.get('token') ?? ''

  // Pointed at the application, never at the admin console — the same defect
  // the password-reset template had before its own migration.
  expect(link).toContain('/confirm-email-change?token=')
  expect(link).not.toContain('/_/#/auth')

  await pb.collection('users').authWithPassword(email, PASSWORD)
  await confirmEmailChange(token, PASSWORD)

  // And now the pair has swapped, both ways round.
  expect(pb.authStore.isValid).toBe(false)
  expect(await signsInWith(wanted, PASSWORD)).toBe(true)
  pb.authStore.clear()
  expect(await signsInWith(email, PASSWORD)).toBe(false)
})

/**
 * The re-authentication that keeps the session alive is `authWithPassword` —
 * exactly the call the second factor intercepts. So the feature broke for the
 * very accounts that had turned on the other feature of the same change: the
 * password WAS changed, and the screen said it had failed.
 *
 * Worse than the wrong message: the SDK writes the updated record back beside
 * the token the rotation had just killed, and `authStore.isValid` only reads
 * the JWT's expiry — so the guard kept the owner inside an application where
 * every request answered 401.
 *
 * Nothing here can finish a sign-in that needs a code, so the honest outcome
 * is to end the session and say so.
 */
it('ends the session rather than lying when a second factor is owed', async () => {
  const email = await createSignedInUser('cred')
  await pb.collection('users').update(pb.authStore.record!.id, { mfa_enabled: true })

  const stillSignedIn = await changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

  expect(stillSignedIn).toBe(false)
  // No zombie: never a record left beside a token the server has forgotten.
  expect(pb.authStore.isValid).toBe(false)
  expect(pb.authStore.record).toBeNull()

  // And the change really did happen, which is what made the old message a lie.
  const challenged = await pb
    .collection('users')
    .authWithPassword(email, NEW_PASSWORD)
    .then(() => undefined)
    .catch((error: { response?: { mfaId?: string } }) => error.response?.mfaId)

  expect(challenged).toBeTypeOf('string')
})

/**
 * A re-authentication can fail for duller reasons than a second factor — a
 * dropped connection, or the rate limiter production turns on. That is a
 * different branch from the one above: this one rethrows, and it is the one
 * that leaves a zombie if it forgets to empty the store first.
 *
 * Only the re-authentication is broken, never the write before it. Failing the
 * whole client would fail `update` instead, and keeping the session would then
 * be correct — nothing would have changed.
 */
it('leaves no session behind when the re-authentication cannot be made', async () => {
  await createSignedInUser('cred')

  pb.beforeSend = (url, options) => {
    if (url.includes('auth-with-password')) throw new Error('the connection dropped')

    return { url, options }
  }

  try {
    await expect(changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD)).rejects.toThrow()
  } finally {
    pb.beforeSend = (url, options) => ({ url, options })
  }

  expect(pb.authStore.isValid).toBe(false)
  expect(pb.authStore.record).toBeNull()
})

// Turning the second factor off used to be one click on a live session: a
// borrowed phone or a lifted token removed the protection silently, which made
// the toggle the weakest part of the thing it guards.
it('refuses to drop the second factor without the password', async () => {
  await createSignedInUser('cred')
  await enableSecondFactor()

  await expect(disableSecondFactor('ce-nest-pas-le-bon')).rejects.toThrow()

  const record = await pb.collection('users').getOne(pb.authStore.record!.id)
  expect(record['mfa_enabled']).toBe(true)
})

// And accepts it with the password — including for the account that still has
// the factor, where the check comes back owing a code. That is not a failure:
// it can only happen once the password has been accepted.
it('drops the second factor for whoever can give the password', async () => {
  await createSignedInUser('cred')
  await enableSecondFactor()

  await disableSecondFactor(PASSWORD)

  const record = await pb.collection('users').getOne(pb.authStore.record!.id)
  expect(record['mfa_enabled']).toBe(false)
})

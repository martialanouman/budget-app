import { beforeEach, expect, it } from 'vitest'
import { PASSWORD, createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const MAILPIT_URL = import.meta.env.VITE_MAILPIT_URL ?? 'http://127.0.0.1:8026'
const MAIL_TIMEOUT_MS = 10_000

/**
 * The one-time code, read from the inbox.
 *
 * Filtered by subject, not merely by recipient: `authAlert` is on, so signing
 * in from a new place sends its own mail to the same address. Taking
 * `messages[0]` would read whichever landed first, and the test would fail
 * roughly whenever the machine was quick — the worst kind of failure to own.
 */
async function waitForCode(recipient: string) {
  const deadline = Date.now() + MAIL_TIMEOUT_MS
  const query = `to:${recipient} subject:"code de connexion"`

  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }

    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0]!.ID}`)
      const { HTML } = (await message.json()) as { HTML: string }
      const code = /<strong>(\d+)<\/strong>/u.exec(HTML)

      if (code) return code[1]!
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error(`No sign-in code reached ${recipient} within ${MAIL_TIMEOUT_MS}ms`)
}

const turnMfaOn = () => pb.collection('users').update(currentUserId()!, { mfa_enabled: true })

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * The load-bearing assumption of this whole change, proven rather than
 * asserted: `options.mfa.rule` gates the challenge per record. Without it MFA
 * would be all-or-nothing for the deployment, and "configure a second factor"
 * would not be something an owner could choose.
 */
it('challenges an account that asked for a second factor', async () => {
  const email = await createSignedInUser('mfa')
  await turnMfaOn()
  pb.authStore.clear()

  const refused = await pb
    .collection('users')
    .authWithPassword(email, PASSWORD)
    .then(() => undefined)
    .catch((error: { response?: { mfaId?: string } }) => error.response?.mfaId)

  expect(refused).toBeTypeOf('string')
  expect(pb.authStore.isValid).toBe(false)
})

// The other half of the same rule. Nobody who did not ask for a second factor
// should meet one, and a rule that challenged everybody would pass the test
// above just as happily.
it('lets an account without a second factor in on the password alone', async () => {
  const email = await createSignedInUser('mfa')
  pb.authStore.clear()

  await pb.collection('users').authWithPassword(email, PASSWORD)

  expect(pb.authStore.isValid).toBe(true)
})

// The whole round trip: password, then the code that came by email.
it('signs in with the password and the code together', async () => {
  const email = await createSignedInUser('mfa')
  await turnMfaOn()
  pb.authStore.clear()

  const mfaId = await pb
    .collection('users')
    .authWithPassword(email, PASSWORD)
    .then(() => '')
    .catch((error: { response?: { mfaId?: string } }) => error.response?.mfaId ?? '')

  const { otpId } = await pb.collection('users').requestOTP(email)
  const code = await waitForCode(email)

  await pb.collection('users').authWithOTP(otpId, code, { mfaId })

  expect(pb.authStore.isValid).toBe(true)
})

/**
 * OTP in PocketBase is a full authentication method, not a second-factor-only
 * one: `mfa.rule` makes a SECOND method mandatory for the records it matches,
 * but it does nothing to stop the first from being the code itself.
 *
 * Enabling OTP therefore handed every account — `mfa_enabled` defaults to
 * false, so every account — a sign-in that needs no password. The screens never
 * offer it; the API does, and unlike a password reset, which rotates the
 * password and drops every session so the owner notices, this is silent.
 */
it('refuses a sign-in made of the emailed code alone', async () => {
  const email = await createSignedInUser('mfa')
  pb.authStore.clear()

  const { otpId } = await pb.collection('users').requestOTP(email)
  const code = await waitForCode(email)

  await expect(pb.collection('users').authWithOTP(otpId, code)).rejects.toThrow()
  expect(pb.authStore.isValid).toBe(false)
})

// The same refusal must not reach the account that turned the second factor on
// — for them the code is the second half of a sign-in, not the whole of it.
it('still accepts the code as the second half of a sign-in', async () => {
  const email = await createSignedInUser('mfa')
  await turnMfaOn()
  pb.authStore.clear()

  const mfaId = await pb
    .collection('users')
    .authWithPassword(email, PASSWORD)
    .then(() => '')
    .catch((error: { response?: { mfaId?: string } }) => error.response?.mfaId ?? '')

  const { otpId } = await pb.collection('users').requestOTP(email)

  await pb.collection('users').authWithOTP(otpId, await waitForCode(email), { mfaId })

  expect(pb.authStore.isValid).toBe(true)
})

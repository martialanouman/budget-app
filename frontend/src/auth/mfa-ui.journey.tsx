import { beforeEach, expect, it } from 'vitest'
import {
  PASSWORD,
  createSignedInUser,
  currentUserId,
  renderApp,
} from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const MAILPIT_URL = import.meta.env.VITE_MAILPIT_URL ?? 'http://127.0.0.1:8026'
const MAIL_TIMEOUT_MS = 10_000

/** Filtered by subject: authAlert mails the same address on a new sign-in. */
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

beforeEach(() => {
  pb.authStore.clear()
})

// The whole point of the feature, walked end to end through the screens.
it('asks for the emailed code before letting a protected account in', async () => {
  const email = await createSignedInUser('mfaui')
  await pb.collection('users').update(currentUserId()!, { mfa_enabled: true })
  pb.authStore.clear()

  const { screen } = await renderApp('/sign-in')

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe').fill(PASSWORD)
  await screen.getByRole('button', { name: 'Se connecter' }).click()

  await expect.element(screen.getByLabelText('Code reçu par e-mail')).toBeVisible()

  const code = await waitForCode(email)

  await screen.getByLabelText('Code reçu par e-mail').fill(code)
  await screen.getByRole('button', { name: 'Valider le code' }).click()

  await expect.element(screen.getByRole('heading', { name: 'Où j’en suis' })).toBeVisible()
})

/**
 * PocketBase answers "password right, second factor owed" with the same 401 it
 * uses for a wrong password — only the mfaId separates them. Told their
 * password was wrong, somebody would go and reset a password that works.
 */
it('does not call a correct password wrong when a code is owed', async () => {
  const email = await createSignedInUser('mfaui')
  await pb.collection('users').update(currentUserId()!, { mfa_enabled: true })
  pb.authStore.clear()

  const { screen } = await renderApp('/sign-in')

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe').fill(PASSWORD)
  await screen.getByRole('button', { name: 'Se connecter' }).click()

  await expect.element(screen.getByLabelText('Code reçu par e-mail')).toBeVisible()
  await expect
    .element(screen.getByText('E-mail ou mot de passe incorrect.'))
    .not.toBeInTheDocument()
})

// And a wrong password is still a wrong password: the branch above must not
// have swallowed the ordinary refusal.
it('still refuses a wrong password outright', async () => {
  const email = await createSignedInUser('mfaui')
  await pb.collection('users').update(currentUserId()!, { mfa_enabled: true })
  pb.authStore.clear()

  const { screen } = await renderApp('/sign-in')

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe').fill('ce-nest-pas-le-bon')
  await screen.getByRole('button', { name: 'Se connecter' }).click()

  await expect.element(screen.getByText('E-mail ou mot de passe incorrect.')).toBeVisible()
})

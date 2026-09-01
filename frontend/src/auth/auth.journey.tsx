import { createMemoryHistory } from '@tanstack/react-router'
import { beforeEach, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { pb } from '@/lib/pocketbase'
import { AppRouterProvider, createAppRouter } from '@/router.tsx'

const PASSWORD = 'motdepasse-solide'
const MAILPIT_URL = import.meta.env.VITE_MAILPIT_URL ?? 'http://127.0.0.1:8026'
const MAIL_TIMEOUT_MS = 10_000

let seq = 0
const uniqueEmail = () => `user${Date.now()}-${++seq}@example.com`

async function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))
  const screen = await render(<AppRouterProvider router={router} />)

  return { screen, router }
}

async function createAccount(email: string) {
  return pb.collection('users').create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
}

async function signInAs(email: string) {
  await pb.collection('users').authWithPassword(email, PASSWORD)
}

async function waitForResetLink(recipient: string) {
  const deadline = Date.now() + MAIL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(recipient)}`,
    )
    const { messages } = (await search.json()) as { messages: { ID: string }[] }

    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0]!.ID}`)
      const { HTML } = (await message.json()) as { HTML: string }
      const link = /href="([^"]+)"/.exec(HTML)

      if (link) return link[1]!
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error(`No reset email reached ${recipient} within ${MAIL_TIMEOUT_MS}ms`)
}

async function requestResetToken(email: string, app: Awaited<ReturnType<typeof renderApp>>) {
  await app.screen.getByLabelText('Adresse e-mail').fill(email)
  await app.screen.getByRole('button', { name: 'Envoyer le lien' }).click()
  await expect.element(app.screen.getByRole('status')).toBeVisible()

  const link = await waitForResetLink(email)

  return { link, token: new URL(link).searchParams.get('token') ?? '' }
}

beforeEach(() => {
  pb.authStore.clear()
})

it('signs up, lands on the protected home, signs out and signs back in', async () => {
  const email = uniqueEmail()
  const { screen } = await renderApp('/sign-up')

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(PASSWORD)
  await screen.getByLabelText('Confirmer le mot de passe').fill(PASSWORD)
  await screen.getByRole('button', { name: 'Créer mon compte' }).click()

  await screen.getByRole('button', { name: 'Menu' }).click()
  await expect.element(screen.getByText(`Bon retour, ${email}`)).toBeVisible()

  await screen.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(PASSWORD)
  await screen.getByRole('button', { name: 'Se connecter' }).click()

  await screen.getByRole('button', { name: 'Menu' }).click()
  await expect.element(screen.getByText(`Bon retour, ${email}`)).toBeVisible()
})

it('sends an anonymous visitor from the protected home to the sign-in screen', async () => {
  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

it('refuses a sign-up whose password confirmation does not match', async () => {
  const { screen } = await renderApp('/sign-up')

  await screen.getByLabelText('Adresse e-mail').fill(uniqueEmail())
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(PASSWORD)
  await screen.getByLabelText('Confirmer le mot de passe').fill(`${PASSWORD}-typo`)
  await screen.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect.element(screen.getByText('Les mots de passe ne correspondent pas')).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Créer un compte' })).toBeVisible()
})

it('blocks the sign-up form on a password shorter than the minimum', async () => {
  const { screen } = await renderApp('/sign-up')

  await screen.getByLabelText('Adresse e-mail').fill(uniqueEmail())
  await screen.getByLabelText('Mot de passe', { exact: true }).fill('court')
  await screen.getByLabelText('Confirmer le mot de passe').fill('court')
  await screen.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect.element(screen.getByRole('alert')).toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Créer un compte' })).toBeVisible()
})

// Nine characters would pass PocketBase's default floor of eight: this fails
// unless the migration raised it to ten.
it('enforces the ten character password floor server-side', async () => {
  const nineCharacters = 'abcdefghi'

  await expect(
    pb.collection('users').create({
      email: uniqueEmail(),
      password: nineCharacters,
      passwordConfirm: nineCharacters,
    }),
  ).rejects.toThrow()
})

it('resets a password through the emailed link', async () => {
  const email = uniqueEmail()
  const newPassword = 'nouveau-mot-de-passe'
  await createAccount(email)

  const app = await renderApp('/forgot-password')
  const { link, token } = await requestResetToken(email, app)

  // The default PocketBase template links to its admin UI; ours must not.
  expect(link).toContain('/reset-password?token=')
  expect(link).not.toContain('/_/#/auth')

  await app.router.navigate({ to: '/reset-password', search: { token } })
  await app.screen.getByLabelText('Nouveau mot de passe').fill(newPassword)
  await app.screen.getByLabelText('Confirmer le mot de passe').fill(newPassword)
  await app.screen.getByRole('button', { name: 'Réinitialiser' }).click()
  await expect.element(app.screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()

  await pb.collection('users').authWithPassword(email, newPassword)
  expect(pb.authStore.isValid).toBe(true)
})

// Resetting from a device that still holds a session used to bounce the user
// back into the app on a token PocketBase had already invalidated.
it('drops the local session when resetting while still signed in', async () => {
  const email = uniqueEmail()
  const newPassword = 'encore-un-mot-de-passe'
  await createAccount(email)
  await signInAs(email)

  const app = await renderApp('/forgot-password')
  const { token } = await requestResetToken(email, app)

  await app.router.navigate({ to: '/reset-password', search: { token } })
  await app.screen.getByLabelText('Nouveau mot de passe').fill(newPassword)
  await app.screen.getByLabelText('Confirmer le mot de passe').fill(newPassword)
  await app.screen.getByRole('button', { name: 'Réinitialiser' }).click()

  await expect.element(app.screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  expect(pb.authStore.isValid).toBe(false)
})

it('leaves the protected home when the session is cleared without navigating', async () => {
  const email = uniqueEmail()
  await createAccount(email)
  await signInAs(email)

  const { screen } = await renderApp('/')
  await expect.element(screen.getByRole('heading', { name: 'Où j’en suis' })).toBeVisible()

  pb.authStore.clear()

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

it('sends a tokenless reset URL back to the request form', async () => {
  const { screen } = await renderApp('/reset-password')

  await expect.element(screen.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible()
})

it('shows a French not-found page for an unknown URL', async () => {
  const { screen } = await renderApp('/cette-page-nexiste-pas')

  await expect.element(screen.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
})

it('never exposes another account to an authenticated user', async () => {
  const mine = uniqueEmail()
  const other = uniqueEmail()
  await createAccount(mine)
  const otherAccount = await createAccount(other)

  await signInAs(mine)

  const readable = await pb.collection('users').getFullList()
  expect(readable.map((record) => record.id)).toEqual([pb.authStore.record?.id])

  await expect(pb.collection('users').getOne(otherAccount.id)).rejects.toThrow()
})

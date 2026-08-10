import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { beforeEach, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { pb } from '@/lib/pocketbase'
import { createAppRouter } from '@/router.tsx'

const PASSWORD = 'motdepasse-solide'
const MAILPIT_URL = import.meta.env.VITE_MAILPIT_URL ?? 'http://127.0.0.1:8026'
const MAIL_TIMEOUT_MS = 10_000

let seq = 0
const uniqueEmail = () => `user${Date.now()}-${++seq}@example.com`

async function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))
  const screen = await render(<RouterProvider router={router} />)

  return { screen, router }
}

async function createAccount(email: string) {
  return pb.collection('users').create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
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

beforeEach(() => {
  pb.authStore.clear()
})

it('signs up, lands on the protected home, signs out and signs back in', async () => {
  const email = uniqueEmail()
  const { screen } = await renderApp('/sign-up')

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe').fill(PASSWORD)
  await screen.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect.element(screen.getByText(`Connecté en tant que ${email}`)).toBeVisible()

  await screen.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()

  await screen.getByLabelText('Adresse e-mail').fill(email)
  await screen.getByLabelText('Mot de passe').fill(PASSWORD)
  await screen.getByRole('button', { name: 'Se connecter' }).click()

  await expect.element(screen.getByText(`Connecté en tant que ${email}`)).toBeVisible()
})

it('sends an anonymous visitor from the protected home to the sign-in screen', async () => {
  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

it('blocks the sign-up form on a password shorter than the minimum', async () => {
  const { screen } = await renderApp('/sign-up')

  await screen.getByLabelText('Adresse e-mail').fill(uniqueEmail())
  await screen.getByLabelText('Mot de passe').fill('court')
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

  const { screen: request, router } = await renderApp('/forgot-password')
  await request.getByLabelText('Adresse e-mail').fill(email)
  await request.getByRole('button', { name: 'Envoyer le lien' }).click()
  await expect.element(request.getByRole('status')).toBeVisible()

  const link = await waitForResetLink(email)
  // The default PocketBase template links to its admin UI; ours must not.
  expect(link).toContain('/reset-password?token=')
  expect(link).not.toContain('/_/#/auth')

  const token = new URL(link).searchParams.get('token') ?? ''
  await router.navigate({ to: '/reset-password', search: { token } })

  await request.getByLabelText('Nouveau mot de passe').fill(newPassword)
  await request.getByRole('button', { name: 'Réinitialiser' }).click()
  await expect.element(request.getByRole('heading', { name: 'Connexion' })).toBeVisible()

  await pb.collection('users').authWithPassword(email, newPassword)
  expect(pb.authStore.isValid).toBe(true)
})

it('never exposes another account to an authenticated user', async () => {
  const mine = uniqueEmail()
  const other = uniqueEmail()
  await createAccount(mine)
  const otherAccount = await createAccount(other)

  await pb.collection('users').authWithPassword(mine, PASSWORD)

  const readable = await pb.collection('users').getFullList()
  expect(readable.map((record) => record.id)).toEqual([pb.authStore.record?.id])

  await expect(pb.collection('users').getOne(otherAccount.id)).rejects.toThrow()
})

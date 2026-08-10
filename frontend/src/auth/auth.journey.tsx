import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { beforeEach, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { pb } from '@/lib/pocketbase'
import { createAppRouter } from '@/router.tsx'

const PASSWORD = 'motdepasse-solide'

let seq = 0
const uniqueEmail = () => `user${Date.now()}-${++seq}@example.com`

function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))

  return render(<RouterProvider router={router} />)
}

async function createAccount(email: string) {
  return pb.collection('users').create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
}

beforeEach(() => {
  pb.authStore.clear()
})

it('signs up, lands on the protected home, signs out and signs back in', async () => {
  const email = uniqueEmail()
  const screen = await renderApp('/sign-up')

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
  const screen = await renderApp('/')

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

it('blocks the sign-up form on a password shorter than the minimum', async () => {
  const screen = await renderApp('/sign-up')

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

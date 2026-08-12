import { createMemoryHistory } from '@tanstack/react-router'
import { beforeEach, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'
import { AppRouterProvider, createAppRouter } from '@/router.tsx'

const PASSWORD = 'motdepasse-solide'

let seq = 0
const uniqueEmail = () => `cats${Date.now()}-${++seq}@example.com`

async function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))

  return render(<AppRouterProvider router={router} />)
}

async function signUpAndSignIn() {
  const email = uniqueEmail()

  await pb.collection('users').create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
  await pb.collection('users').authWithPassword(email, PASSWORD)
}

beforeEach(() => {
  pb.authStore.clear()
})

// CAT-01: seeded by a hook at sign-up, so the account is usable immediately.
it('gives a brand new account its default categories, with no action taken', async () => {
  await signUpAndSignIn()

  const categories = await pb.collection('categories').getFullList<Category>()

  expect(categories.length).toBeGreaterThan(0)
  expect(categories.map((category) => category.name)).toContain('Alimentation')
  expect(categories.every((category) => category.active)).toBe(true)

  const kinds = new Set(categories.map((category) => category.kind))
  expect([...kinds].sort()).toEqual(['fixe', 'variable'])
})

// Scoped to the buttons: the category names also appear as options in the
// parent selector, so a bare text locator matches several elements.
it('lists the default categories with their nature', async () => {
  await signUpAndSignIn()
  const screen = await renderApp('/categories')

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Alimentation' }))
    .toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Désactiver Logement' })).toBeVisible()
})

it('adds a sub-category under an existing one', async () => {
  await signUpAndSignIn()
  const screen = await renderApp('/categories')

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Alimentation' }))
    .toBeVisible()

  await screen.getByLabelText('Nom').fill('Restaurant')
  await screen.getByLabelText('Catégorie parente').selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()

  await expect.element(screen.getByText('Restaurant')).toBeVisible()
})

// CAT-02 deactivates instead of deleting, so past transactions keep their link.
it('deactivates a category without losing it', async () => {
  await signUpAndSignIn()
  const screen = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Désactiver Loisirs' }).click()

  await expect.element(screen.getByRole('button', { name: 'Réactiver Loisirs' })).toBeVisible()

  const remaining = await pb.collection('categories').getFullList<Category>()
  expect(remaining.map((category) => category.name)).toContain('Loisirs')
})

it('never exposes another owner’s categories', async () => {
  await signUpAndSignIn()
  const mine = await pb.collection('categories').getFullList<Category>()

  await signUpAndSignIn()
  const theirs = await pb.collection('categories').getFullList<Category>()

  const overlap = theirs.filter((category) => mine.some((own) => own.id === category.id))
  expect(overlap).toEqual([])
})

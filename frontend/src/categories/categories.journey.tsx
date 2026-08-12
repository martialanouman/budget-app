import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const listCategories = () => pb.collection('categories').getFullList<Category>()

beforeEach(() => {
  pb.authStore.clear()
})

// CAT-01: seeded by a hook at sign-up, so the account is usable immediately.
it('gives a brand new account its default categories, with no action taken', async () => {
  await createSignedInUser('cats')

  const categories = await listCategories()

  expect(categories.length).toBeGreaterThan(0)
  expect(categories.map((category) => category.name)).toContain('Alimentation')
  expect(categories.every((category) => category.active)).toBe(true)

  const kinds = new Set(categories.map((category) => category.kind))
  expect([...kinds].sort()).toEqual(['fixe', 'variable'])
})

// Scoped to the buttons: the category names also appear as options in the
// parent selector, so a bare text locator matches several elements.
it('lists the default categories', async () => {
  await createSignedInUser('cats')
  const { screen } = await renderApp('/categories')

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Alimentation' }))
    .toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Désactiver Logement' })).toBeVisible()
})

it('adds a sub-category and lets it be deactivated too', async () => {
  await createSignedInUser('cats')
  const { screen } = await renderApp('/categories')

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Alimentation' }))
    .toBeVisible()

  await screen.getByLabelText('Nom').fill('Restaurant')
  await screen.getByLabelText('Catégorie parente').selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()

  // CAT-02 has to be reachable on a child, not only on a root.
  await screen.getByRole('button', { name: 'Désactiver Restaurant' }).click()
  await expect.element(screen.getByRole('button', { name: 'Réactiver Restaurant' })).toBeVisible()
})

// CAT-02 deactivates instead of deleting, so past transactions keep their link.
it('deactivates a category without losing it', async () => {
  await createSignedInUser('cats')
  const { screen } = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Désactiver Loisirs' }).click()

  await expect.element(screen.getByRole('button', { name: 'Réactiver Loisirs' })).toBeVisible()
  expect((await listCategories()).map((category) => category.name)).toContain('Loisirs')
})

it('stops offering a deactivated category as a parent', async () => {
  await createSignedInUser('cats')
  const { screen } = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Désactiver Loisirs' }).click()
  await expect.element(screen.getByRole('button', { name: 'Réactiver Loisirs' })).toBeVisible()

  await expect
    .element(screen.getByLabelText('Catégorie parente').getByRole('option', { name: 'Loisirs' }))
    .not.toBeInTheDocument()
})

it('never exposes another owner’s categories', async () => {
  await createSignedInUser('cats')
  const mine = await listCategories()

  await createSignedInUser('other')
  const theirs = await listCategories()

  const overlap = theirs.filter((category) => mine.some((own) => own.id === category.id))
  expect(overlap).toEqual([])
})

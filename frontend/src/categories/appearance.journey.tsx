import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Account, type Category } from '@/lib/collections'
import { FALLBACK_ICON, HUES, hueFor } from '@/lib/appearance'
import { pb } from '@/lib/pocketbase'

const listCategories = () => pb.collection('categories').getFullList<Category>()

const found = async (name: string) =>
  (await listCategories()).find((category) => category.name === name)!

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * CAT-04, at the one moment nobody chooses anything: sign-up. Eleven default
 * categories arrive from a hook, and a colourless one among ten coloured reads
 * as a defect rather than as a default.
 *
 * Discriminating: drop `icon` from the seed hook and this reddens.
 */
it('gives every seeded category an icon and a colour of its own', async () => {
  await createSignedInUser('appear')

  const categories = await listCategories()

  expect(categories.length).toBe(11)
  expect(categories.every((category) => category.icon !== '')).toBe(true)
  expect(categories.every((category) => HUES.includes(category.color as never))).toBe(true)

  // Not the same one eleven times, which a broken loop would also satisfy.
  expect(new Set(categories.map((category) => category.icon)).size).toBe(11)
  expect((await found('Alimentation')).icon).toBe('🍚')
})

// The picker has to reach the database, not merely the form: the fields are new
// and nothing else in the application had ever written to them.
it('keeps the icon and the colour chosen for a new category', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/categories')

  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()
  await screen.getByLabelText('Nom').fill('Coiffeur')
  await screen.getByLabelText('👕').click()
  await screen.getByLabelText('Indigo').click()
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()

  await expect.element(screen.getByRole('button', { name: 'Désactiver Coiffeur' })).toBeVisible()

  const created = await found('Coiffeur')
  expect(created.icon).toBe('👕')
  expect(created.color).toBe('indigo')
})

/**
 * The rows that existed before the migration, which nothing back-filled. The
 * screen must still draw them, and draw them the same way twice — a dot whose
 * colour moved between two renders would be worse than no dot at all.
 */
it('derives an appearance for a category that has neither', async () => {
  await createSignedInUser('appear')

  await pb.collection('categories').create({
    user: currentUserId(),
    name: 'Sans apparence',
    kind: 'variable',
    active: true,
    icon: '',
    color: '',
  })

  const { screen } = await renderApp('/categories')

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Sans apparence' }))
    .toBeVisible()

  // Stable, and inside the set the stylesheet knows about.
  expect(hueFor('Sans apparence')).toBe(hueFor('Sans apparence'))
  expect(HUES).toContain(hueFor('Sans apparence'))
})

// CPT-02 has asked for an account colour since the first specification, and
// `accounts.color` has been in the collection since step 3 with nothing ever
// writing to it. Discriminating: remove `color` from the account draft.
it('keeps the colour chosen for a new account', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/accounts')

  await screen.getByRole('heading', { name: 'Ajouter un compte' }).click()
  await screen.getByLabelText('Nom').fill('Wave')
  await screen.getByLabelText('Solde initial').fill('38200')
  await screen.getByLabelText('Sarcelle').click()
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByRole('button', { name: 'Archiver Wave' })).toBeVisible()

  const accounts = await pb.collection('accounts').getFullList<Account>()
  expect(accounts.find((account) => account.name === 'Wave')?.color).toBe('sarcelle')
})

/**
 * USR-04. The export sends these collections through `publicExport()`, so new
 * columns travel on their own — unlike the account block, which is an explicit
 * allow-list. This test is what says so, rather than the reading that says so.
 */
it('carries the new fields into the data export', async () => {
  await createSignedInUser('appear')

  const response: { categories: Category[] } = await pb.send('/api/export', { method: 'GET' })
  const alimentation = response.categories.find((category) => category.name === 'Alimentation')

  expect(alimentation?.icon).toBe('🍚')
  expect(alimentation?.color).toBe('terracotta')
})

// The neutral default is neutral on purpose: no derivation can know that a
// category called "Coiffeur" wants a particular emoji, and a hash into the
// grid would hand it a taxi.
it('offers a neutral icon rather than guessing one', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/categories')

  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()
  await screen.getByLabelText('Nom').fill('Quelque chose')
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Quelque chose' }))
    .toBeVisible()

  expect((await found('Quelque chose')).icon).toBe(FALLBACK_ICON)
})

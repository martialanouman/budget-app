import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const listCategories = () => pb.collection('categories').getFullList<Category>()

const idOf = async (name: string) =>
  (await listCategories()).find((category) => category.name === name)!.id

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
  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()

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
  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()

  await screen.getByRole('button', { name: 'Désactiver Loisirs' }).click()
  await expect.element(screen.getByRole('button', { name: 'Réactiver Loisirs' })).toBeVisible()

  await expect
    .element(screen.getByLabelText('Catégorie parente').getByRole('option', { name: 'Loisirs' }))
    .not.toBeInTheDocument()
})

// Removing the option resets what the browser shows but emits no change event,
// so the form can still be holding the retired parent's id.
it('does not file a new category under a parent deactivated meanwhile', async () => {
  await createSignedInUser('cats')
  const { screen } = await renderApp('/categories')
  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()

  await screen.getByLabelText('Catégorie parente').selectOptions('Loisirs')
  await screen.getByRole('button', { name: 'Désactiver Loisirs' }).click()
  await expect.element(screen.getByRole('button', { name: 'Réactiver Loisirs' })).toBeVisible()

  await screen.getByLabelText('Nom').fill('Concert')
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()

  await expect.element(screen.getByRole('button', { name: 'Désactiver Concert' })).toBeVisible()

  const concert = (await listCategories()).find((category) => category.name === 'Concert')
  expect(concert?.parent).toBe('')
})

it('never exposes another owner’s categories', async () => {
  await createSignedInUser('cats')
  const mine = await listCategories()

  await createSignedInUser('other')
  const theirs = await listCategories()

  const overlap = theirs.filter((category) => mine.some((own) => own.id === category.id))
  expect(overlap).toEqual([])
})

// The rule of the project is that nothing is deleted, so history stays
// attachable. A category nothing points at has no history to protect, and
// deactivating it only keeps it on screen for ever.
it('deletes a category nothing points at', async () => {
  await createSignedInUser('cats')
  const { screen } = await renderApp('/categories')
  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()

  await screen.getByLabelText('Nom').fill('Créée par erreur')
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()
  await expect
    .element(screen.getByRole('button', { name: 'Supprimer Créée par erreur' }))
    .toBeVisible()

  await screen.getByRole('button', { name: 'Supprimer Créée par erreur' }).click()

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Créée par erreur' }))
    .not.toBeInTheDocument()
  expect((await listCategories()).map((category) => category.name)).not.toContain(
    'Créée par erreur',
  )
})

// Offering a button that will fail teaches the obstacle at the costliest
// moment. The row says what holds the category instead, and deactivation stays
// available.
it('says what holds a category rather than offering to delete it', async () => {
  await createSignedInUser('cats')
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 100_000,
  })
  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: await idOf('Alimentation'),
    type: 'depense',
    amount: 5_000,
    date: '2026-08-12 10:00:00',
  })

  const { screen } = await renderApp('/categories')

  await expect.element(screen.getByText('Non supprimable — 1 transaction')).toBeVisible()
  await expect
    .element(screen.getByRole('button', { name: 'Supprimer Alimentation' }))
    .not.toBeInTheDocument()
  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Alimentation' }))
    .toBeVisible()
})

// An envelope is what makes this worth guarding: budgets.category cascades, so
// a delete that got through would take the caps of every past month with it.
it('counts an envelope as something that holds a category', async () => {
  await createSignedInUser('cats')
  await pb.collection('budgets').create({
    user: currentUserId(),
    category: await idOf('Loisirs'),
    month: '2026-08',
    cap_amount: 40_000,
  })

  const { screen } = await renderApp('/categories')

  await expect.element(screen.getByText('Non supprimable — 1 enveloppe')).toBeVisible()
  await expect
    .element(screen.getByRole('button', { name: 'Supprimer Loisirs' }))
    .not.toBeInTheDocument()
})

it('counts a sub-category as something that holds its parent', async () => {
  await createSignedInUser('cats')
  await pb.collection('categories').create({
    user: currentUserId(),
    name: 'Concert',
    kind: 'variable',
    parent: await idOf('Loisirs'),
    active: true,
  })

  const { screen } = await renderApp('/categories')

  await expect.element(screen.getByText('Non supprimable — 1 sous-catégorie')).toBeVisible()
  await expect
    .element(screen.getByRole('button', { name: 'Supprimer Loisirs' }))
    .not.toBeInTheDocument()
  // The child itself is held by nothing.
  await expect.element(screen.getByRole('button', { name: 'Supprimer Concert' })).toBeVisible()
})

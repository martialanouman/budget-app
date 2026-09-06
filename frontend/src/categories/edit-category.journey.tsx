import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Account, type Category } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

const SAVE = 'Enregistrer les modifications'

const found = async (name: string) =>
  (await pb.collection('categories').getFullList<Category>()).find(
    (category) => category.name === name,
  )

/**
 * The ornament a row carries to the left of its name — decoration, so it is
 * reached through the row rather than through the accessibility tree.
 */
const decorationIn = (name: string) => {
  const row = [...document.querySelectorAll('li')].find((item) => item.textContent?.includes(name))
  const decoration = row?.querySelector<HTMLElement>('[aria-hidden="true"]')

  if (!decoration) throw new Error(`No row carrying "${name}" is on screen`)

  return decoration
}

const seedCategory = (fields: Partial<Category>) =>
  pb.collection('categories').create<Category>({
    user: currentUserId(),
    kind: 'variable',
    active: true,
    parent: '',
    icon: '',
    color: '',
    ...fields,
  })

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * CAT-02's renaming, which neither list screen had ever offered: the hooks have
 * existed since step 3 and nothing called them.
 *
 * The entry is what makes this more than a form test. §8 asked whether renaming
 * has to replay anything, and a transaction points at its category by relation,
 * so the answer is no — this is what says so, rather than a reading of the
 * schema.
 */
it('renames a category, and an entry filed under it follows without being touched', async () => {
  await createSignedInUser('editcat')
  const category = await seedCategory({ name: 'Coifeur', icon: '👕', color: 'indigo' })
  const account = await pb.collection('accounts').create<Account>({
    user: currentUserId(),
    name: 'Wave',
    type: 'mobile_money',
    initial_balance: 50000,
    color: '',
    archived: false,
  })
  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: category.id,
    type: 'depense',
    amount: 3000,
    date: todayLocally(),
    note: 'Coupe du samedi',
  })

  const { screen } = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Modifier Coifeur' }).click()
  await screen.getByRole('dialog').getByLabelText('Nom').fill('Coiffeur')
  await screen.getByRole('button', { name: SAVE }).click()

  // The sheet closes on success, and only on success.
  await expect.element(screen.getByRole('button', { name: SAVE })).not.toBeInTheDocument()
  await expect.element(screen.getByRole('button', { name: 'Désactiver Coiffeur' })).toBeVisible()

  await screen.getByRole('link', { name: 'Transactions' }).click()

  // The note says the history has actually loaded. Asserting the absence of the
  // old spelling before that would pass on an empty screen — the trap this
  // repository has now hit twice.
  await expect.element(screen.getByText(/Coupe du samedi/u)).toBeVisible()
  await expect.element(screen.getByText('Coifeur')).not.toBeInTheDocument()
})

// CAT-04's other half: an icon clicked wrong was clicked wrong for good.
it('corrects the icon and the nature of a category created with the wrong ones', async () => {
  await createSignedInUser('editcat')
  await seedCategory({ name: 'Loyer', icon: '🚕', color: 'ambre', kind: 'variable' })

  const { screen } = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Modifier Loyer' }).click()

  const sheet = screen.getByRole('dialog')
  await sheet.getByLabelText('🏠').click()
  await sheet.getByLabelText('Nature').selectOptions('fixe')
  await screen.getByRole('button', { name: SAVE }).click()

  await expect.element(screen.getByRole('button', { name: SAVE })).not.toBeInTheDocument()

  expect(decorationIn('Loyer').textContent).toBe('🏠')

  const saved = await found('Loyer')
  expect(saved?.icon).toBe('🏠')
  expect(saved?.kind).toBe('fixe')
})

/**
 * A category cannot be filed under itself, and the select is the only place
 * that could offer it. Left on offer, the row would vanish: the screen draws
 * the roots and then each root's children, and a category that is its own
 * parent is neither.
 */
it('never offers a category as its own parent', async () => {
  await createSignedInUser('editcat')
  await seedCategory({ name: 'Transport bis' })

  const { screen } = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Modifier Transport bis' }).click()

  const parents = screen.getByRole('dialog').getByLabelText('Catégorie parente')

  await expect.element(parents).toBeVisible()

  const options = [...parents.element().querySelectorAll('option')].map(
    (option) => option.textContent,
  )

  expect(options).toContain('Alimentation')
  expect(options).not.toContain('Transport bis')
})

/**
 * A sub-category whose parent has been retired. `selectableParents` drops
 * deactivated roots so that no new child is filed under one — right for the
 * creation form, and quietly destructive on a correction: the parent held in
 * the form no longer matches an option, so saving anything at all would have
 * promoted the child to the root without a word.
 */
it('keeps a deactivated parent on offer while its child is corrected', async () => {
  await createSignedInUser('editcat')
  const parent = await seedCategory({ name: 'Maison', active: false })
  await seedCategory({ name: 'Cuisine', parent: parent.id })

  const { screen } = await renderApp('/categories')

  await screen.getByRole('button', { name: 'Modifier Cuisine' }).click()
  await screen.getByRole('dialog').getByLabelText('Nom').fill('Cuisine et courses')
  await screen.getByRole('button', { name: SAVE }).click()

  await expect.element(screen.getByRole('button', { name: SAVE })).not.toBeInTheDocument()

  expect((await found('Cuisine et courses'))?.parent).toBe(parent.id)
})

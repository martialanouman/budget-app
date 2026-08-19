import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(`^-?${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

async function anAccountAndCategory(initialBalance: number) {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: initialBalance,
  })
  const categories = await pb.collection('categories').getFullList<Category>()

  return { account, category: categories.find((one) => one.name === 'Alimentation')! }
}

beforeEach(() => {
  pb.authStore.clear()
})

async function fillEntry(
  screen: Awaited<ReturnType<typeof renderApp>>['screen'],
  amount: string,
  type: string,
) {
  await screen.getByLabelText('Montant', { exact: true }).fill(amount)
  await screen.getByLabelText('Type').selectOptions(type)
  await screen.getByLabelText('Compte', { exact: true }).selectOptions('Compte courant')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()
}

// Deliberately never calls selectOptions: Playwright always dispatches a change
// event, which papers over a select whose displayed option and form value have
// drifted apart. A real user who accepts the defaults dispatches nothing.
it('records an entry from the defaults the screen already shows', async () => {
  await createSignedInUser('trx')
  await anAccountAndCategory(150_000)

  const { screen } = await renderApp('/transactions')
  await expect.element(screen.getByLabelText('Compte', { exact: true })).toBeVisible()

  // The account keeps whatever the screen shows; only the category, which must
  // be a deliberate choice, is picked.
  await screen.getByLabelText('Montant', { exact: true }).fill('20 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText(xof('20 000'))).toBeVisible()
})

// TRX-01 and the balance it moves: the whole point of the quick entry screen.
it('records an expense and moves the account balance', async () => {
  await createSignedInUser('trx')
  await anAccountAndCategory(150_000)

  const { screen } = await renderApp('/transactions')
  await fillEntry(screen, '20 000', 'depense')

  await expect.element(screen.getByText(xof('20 000'))).toBeVisible()

  await screen.getByRole('link', { name: 'Comptes' }).click()
  await expect.element(screen.getByText(xof('130 000'))).toBeVisible()
})

it('records an income and raises the balance', async () => {
  await createSignedInUser('trx')
  await anAccountAndCategory(150_000)

  const { screen } = await renderApp('/transactions')
  await fillEntry(screen, '50 000', 'revenu')

  await screen.getByRole('link', { name: 'Comptes' }).click()
  await expect.element(screen.getByText(xof('200 000'))).toBeVisible()
})

// TRX-05: deleting has to give the money back, not merely hide the row.
it('restores the balance when the transaction is deleted', async () => {
  await createSignedInUser('trx')
  await anAccountAndCategory(150_000)

  const { screen } = await renderApp('/transactions')
  await fillEntry(screen, '20 000', 'depense')
  await expect.element(screen.getByText(xof('20 000'))).toBeVisible()

  // Two taps on purpose: the row is hard-deleted and the button sits next to
  // the amount on a phone.
  await screen.getByRole('button', { name: /^Supprimer Alimentation/u }).click()
  await screen.getByRole('button', { name: /^Confirmer la suppression Alimentation/u }).click()

  await expect.element(screen.getByText('Aucune transaction.')).toBeVisible()

  await screen.getByRole('link', { name: 'Comptes' }).click()
  await expect.element(screen.getByText(xof('150 000'))).toBeVisible()
})

it.each(['0', '-500', '1500,75'])('refuses the amount "%s"', async (amount) => {
  await createSignedInUser('trx')
  await anAccountAndCategory(150_000)

  const { screen } = await renderApp('/transactions')
  await fillEntry(screen, amount, 'depense')

  await expect.element(screen.getByText('Montant en francs, supérieur à zéro')).toBeVisible()
  expect(await pb.collection('transactions').getFullList()).toEqual([])
})

it('filters the history by category', async () => {
  await createSignedInUser('trx')
  const { account } = await anAccountAndCategory(150_000)
  const categories = await pb.collection('categories').getFullList<Category>()
  const transport = categories.find((one) => one.name === 'Transport')!
  const food = categories.find((one) => one.name === 'Alimentation')!

  for (const [category, amount] of [
    [food.id, 20_000],
    [transport.id, 5_000],
  ] as const) {
    await pb.collection('transactions').create({
      user: currentUserId(),
      account: account.id,
      category,
      type: 'depense',
      amount,
      date: '2026-08-12 10:00:00',
    })
  }

  const { screen } = await renderApp('/transactions')
  await expect.element(screen.getByText(xof('20 000'))).toBeVisible()

  await screen.getByLabelText('Filtrer par catégorie').selectOptions('Transport')

  await expect.element(screen.getByText(xof('5 000'))).toBeVisible()
  await expect.element(screen.getByText(xof('20 000'))).not.toBeInTheDocument()
})

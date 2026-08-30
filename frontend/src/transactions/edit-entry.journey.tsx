import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category, type Transaction } from '@/lib/collections'
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

const anExpense = (account: string, category: string, amount: number) =>
  pb.collection('transactions').create<Transaction>({
    user: currentUserId(),
    account,
    category,
    type: 'depense',
    amount,
    date: '2026-08-20 10:00:00',
    note: 'Marché',
  })

/** Ages an entry past the window; see entry-window.journey.ts for the why. */
const settle = (id: string) =>
  pb.send('/api/test/backdate-transaction', {
    method: 'POST',
    body: { id, created: new Date(Date.now() - 400 * 86_400_000).toISOString().replace('T', ' ') },
  })

beforeEach(() => {
  pb.authStore.clear()
})

// TRX-05's missing half. Until now a wrong figure could only be removed and
// typed again, and the assertion that matters is the balance: a correction has
// to move it by the difference, not by the whole amount twice.
it('corrects an expense and moves the balance by the difference', async () => {
  await createSignedInUser('edit')
  const { account, category } = await anAccountAndCategory(150_000)
  await anExpense(account.id, category.id, 20_000)

  const { screen } = await renderApp('/transactions')

  await screen.getByRole('button', { name: /^Modifier Alimentation sur Compte courant/u }).click()
  await expect.element(screen.getByLabelText('Montant', { exact: true })).toBeVisible()

  await screen.getByLabelText('Montant', { exact: true }).fill('25 000')
  await screen.getByRole('button', { name: 'Enregistrer les modifications' }).click()

  await expect.element(screen.getByText(xof('25 000'))).toBeVisible()

  await screen.getByRole('link', { name: 'Comptes' }).click()
  await expect.element(screen.getByText(xof('125 000'))).toBeVisible()
})

// The form is opened on the row, not on the defaults: a correction that arrived
// pre-filled with today's date and an empty note would quietly rewrite both.
it('opens the correction on what the entry already holds', async () => {
  await createSignedInUser('edit')
  const { account, category } = await anAccountAndCategory(150_000)
  await anExpense(account.id, category.id, 20_000)

  const { screen } = await renderApp('/transactions')

  await screen.getByRole('button', { name: /^Modifier Alimentation sur Compte courant/u }).click()

  await expect.element(screen.getByLabelText('Montant', { exact: true })).toHaveValue('20000')

  // Exact: the history's own "Rechercher dans les notes" is still on the page
  // behind the sheet, and shares the word.
  await screen.getByText('Date et note').click()
  await expect.element(screen.getByLabelText('Note', { exact: true })).toHaveValue('Marché')
  await expect.element(screen.getByLabelText('Date', { exact: true })).toHaveValue('2026-08-20')
})

// The server refuses a settled entry either way. Offering the button anyway
// would make the deadline something one discovers by losing an edit to it.
it('offers neither button once the entry has settled', async () => {
  await createSignedInUser('edit')
  const { account, category } = await anAccountAndCategory(150_000)
  const entry = await anExpense(account.id, category.id, 20_000)

  await settle(entry.id)

  const { screen } = await renderApp('/transactions')

  await expect.element(screen.getByText(xof('20 000'))).toBeVisible()
  await expect.element(screen.getByRole('button', { name: /^Modifier/u })).not.toBeInTheDocument()
  await expect.element(screen.getByRole('button', { name: /^Supprimer/u })).not.toBeInTheDocument()
})

// A leg is never editable at any age: the pair is written and removed as one,
// and a PATCH flipping its type once invented 60 000 F.
it('offers no correction on a leg of a transfer', async () => {
  await createSignedInUser('edit')
  const { account } = await anAccountAndCategory(150_000)
  const savings = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Épargne',
    type: 'epargne',
    initial_balance: 20_000,
  })

  await pb.send('/api/transfers', {
    method: 'POST',
    body: { from: account.id, to: savings.id, amount: 30_000, date: '2026-08-21 09:00:00' },
  })

  const { screen } = await renderApp('/transactions')

  // Named by its row rather than by its amount: a transfer puts 30 000 on the
  // page twice, once with each sign.
  await expect.element(screen.getByText('Virement sortant · Compte courant')).toBeVisible()
  await expect.element(screen.getByRole('button', { name: /^Modifier/u })).not.toBeInTheDocument()

  // Deleting stays offered, and the distinction is the point: the pair falls
  // together on purpose, while editing one leg alone is what invents money.
  // Gating both buttons on the same rule took the delete button away and broke
  // a transfer journey that had been green for two steps.
  await expect
    .element(screen.getByRole('button', { name: /^Supprimer Virement sortant/u }))
    .toBeVisible()
})

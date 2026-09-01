import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category, type Transaction } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(`^-?${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

/** One page holds 50; every count here is chosen against that. */
const A_PAGE = 50

async function anAccountAndCategory() {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 5_000_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()

  return { account, category: categories.find((one) => one.name === 'Alimentation')! }
}

/** Entries sharing a date and an instant, written past the hooks. */
const seedDay = (account: string, category: string, date: string, count: number, amount = 1_000) =>
  pb.send('/api/test/seed-day', {
    method: 'POST',
    body: { account, category, date, count, amount },
  })

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * Three properties in one pass, because they only exist together: the list
 * stops at a page, offers a way past it, and refuses to total a day it has not
 * finished reading.
 *
 * The sentinel is genuinely below the fold here — fifty rows are taller than
 * the frame — so nothing loads until it is scrolled to. That is what makes the
 * withheld total observable rather than a race.
 */
it('withholds a half-read day, then totals it once the rest is scrolled in', async () => {
  await createSignedInUser('infinite')
  const { account, category } = await anAccountAndCategory()

  await seedDay(account.id, category.id, '2026-08-20', A_PAGE + 5)

  const { screen } = await renderApp('/transactions')

  const more = screen.getByRole('button', { name: 'Charger plus' })

  // A page short of the whole day: the figure would be 50 000 of the real
  // 55 000, and a wrong total is worse than none on the screen that reports
  // spending.
  await expect.element(more).toBeVisible()
  await expect.element(screen.getByText(/dépensé/u)).not.toBeInTheDocument()

  // Scrolled to rather than clicked: this is the path a reader actually takes,
  // and it exercises the observer instead of the button beside it.
  more.element().scrollIntoView()

  await expect.element(screen.getByText(/55\s000\sF\sCFA\sdépensé/u)).toBeVisible()
  await expect.element(more).not.toBeInTheDocument()
})

// Every entry of this fixture shares a date and an instant, the hardest case
// for offset paging. This guards the paging arithmetic — a wrong page number
// or size shows up here as a gap or a repeat.
//
// It does not discriminate the `-id` in the sort: dropping it leaves the test
// green, because both pages take the same query plan and SQLite returns tied
// rows in the same order. Checked, rather than assumed.
it('does not lose or repeat an entry across a page boundary', async () => {
  await createSignedInUser('infinite')
  const { account, category } = await anAccountAndCategory()

  await seedDay(account.id, category.id, '2026-08-20', A_PAGE + 20)

  const sorted = { sort: '-date,-created,-id' }
  const first = await pb.collection('transactions').getList<Transaction>(1, A_PAGE, sorted)
  const second = await pb.collection('transactions').getList<Transaction>(2, A_PAGE, sorted)

  const seen = [...first.items, ...second.items].map((entry) => entry.id)

  expect(seen).toHaveLength(A_PAGE + 20)
  expect(new Set(seen).size).toBe(A_PAGE + 20)
})

it('filters the history down to a single month', async () => {
  await createSignedInUser('infinite')
  const { account, category } = await anAccountAndCategory()

  await seedDay(account.id, category.id, '2026-08-20', 1, 40_000)
  await seedDay(account.id, category.id, '2026-07-15', 1, 25_000)

  const { screen } = await renderApp('/transactions')

  await expect.element(screen.getByText(xof('40 000'))).toBeVisible()
  await expect.element(screen.getByText(xof('25 000'))).toBeVisible()

  // Named as the budgets screen names it, not as the API stores it: a native
  // month control would have shown an English month on a French page.
  await screen.getByLabelText('Filtrer par mois').selectOptions('juillet 2026')

  await expect.element(screen.getByText(xof('25 000'))).toBeVisible()
  await expect.element(screen.getByText(xof('40 000'))).not.toBeInTheDocument()
})

// The month list reaches back exactly as far as the history does. Offered a
// fixed window instead, someone with three years of entries could not filter
// to their oldest month.
it('offers every month the history covers, and no others', async () => {
  await createSignedInUser('infinite')
  const { account, category } = await anAccountAndCategory()

  await seedDay(account.id, category.id, '2026-06-10', 1)

  const { screen } = await renderApp('/transactions')

  await expect.element(screen.getByRole('option', { name: 'juin 2026' })).toBeInTheDocument()
  await expect.element(screen.getByRole('option', { name: 'mai 2026' })).not.toBeInTheDocument()
})

// A brand-new account has no oldest month, and the query that looks for one
// returned undefined — which TanStack Query refuses as data, failing the query
// rather than resolving it. Nothing showed, because the screen offers no
// months either way; the console said so and the query sat in error.
it('opens on an account with no history at all', async () => {
  await createSignedInUser('infinite')
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 0,
  })

  const { screen, client } = await renderApp('/transactions')

  await expect.element(screen.getByText('Aucune transaction.')).toBeVisible()
  await expect.element(screen.getByRole('option', { name: 'Tous les mois' })).toBeInTheDocument()

  expect(client.getQueryState(['transactions', 'earliest'])?.status).toBe('success')
})

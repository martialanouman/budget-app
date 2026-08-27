import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type BudgetSpending, type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

async function context() {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 500_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()

  return {
    account: account.id,
    food: categories.find((one) => one.name === 'Alimentation')!.id,
    home: categories.find((one) => one.name === 'Logement')!.id,
  }
}

const anEntry = (fields: Record<string, unknown>) =>
  pb.collection('transactions').create({ user: currentUserId(), note: '', ...fields })

const spending = async () => {
  const rows = await pb.collection('budget_spending').getFullList<BudgetSpending>()

  return Object.fromEntries(rows.map((row) => [`${row.category}@${row.month}`, row.spent]))
}

beforeEach(() => {
  pb.authStore.clear()
})

// BUD-03: what an envelope has consumed is summed in SQLite, per category and
// per calendar month, and never stored.
it('sums spending by category and by month', async () => {
  await createSignedInUser('bs')
  const { account, food, home } = await context()

  await anEntry({ account, category: food, type: 'depense', amount: 35_000, date: '2026-08-04' })
  await anEntry({ account, category: food, type: 'depense', amount: 15_000, date: '2026-08-27' })
  await anEntry({ account, category: home, type: 'depense', amount: 90_000, date: '2026-08-01' })
  await anEntry({ account, category: food, type: 'depense', amount: 5_000, date: '2026-09-02' })

  const totals = await spending()

  expect(totals[`${food}@2026-08`]).toBe(50_000)
  expect(totals[`${home}@2026-08`]).toBe(90_000)
  expect(totals[`${food}@2026-09`]).toBe(5_000)
})

// An envelope is a spending limit: income and transfers have no business in it.
it('counts spending only', async () => {
  await createSignedInUser('bs')
  const { account, food } = await context()

  await anEntry({ account, category: food, type: 'depense', amount: 20_000, date: '2026-08-04' })
  await anEntry({ account, category: food, type: 'revenu', amount: 300_000, date: '2026-08-05' })

  expect((await spending())[`${food}@2026-08`]).toBe(20_000)
})

it('never shows another owner’s spending', async () => {
  await createSignedInUser('victim')
  const theirs = await context()
  await anEntry({
    account: theirs.account,
    category: theirs.food,
    type: 'depense',
    amount: 42_000,
    date: '2026-08-04',
  })

  await createSignedInUser('intruder')

  expect(await spending()).toEqual({})
})

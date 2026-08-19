import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type AccountBalance, type Category, type Transaction } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'
import { splitTransaction } from './splits-api.ts'

async function context() {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 150_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()

  return {
    account: account.id,
    food: categories.find((one) => one.name === 'Alimentation')!.id,
    home: categories.find((one) => one.name === 'Logement')!.id,
  }
}

const balanceOf = async (accountId: string) => {
  const rows = await pb.collection('account_balances').getFullList<AccountBalance>()

  return rows.find((row) => row.id === accountId)?.balance
}

beforeEach(() => {
  pb.authStore.clear()
})

// TRX-08: one purchase, several categories. Each row counts once everywhere,
// so balances and budgets need no special case.
it('splits a purchase across categories and takes the total once', async () => {
  await createSignedInUser('sp')
  const { account, food, home } = await context()

  await splitTransaction({
    account,
    date: '2026-08-19',
    note: 'Courses',
    parts: [
      { category: food, amount: 35_000 },
      { category: home, amount: 15_000 },
    ],
  })

  const rows = await pb.collection('transactions').getFullList<Transaction>()

  expect(rows).toHaveLength(2)
  expect(new Set(rows.map((row) => row.split_group)).size).toBe(1)
  expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(50_000)
  expect(await balanceOf(account)).toBe(100_000)
})

it('refuses a split with a single part', async () => {
  await createSignedInUser('sp')
  const { account, food } = await context()

  await expect(
    splitTransaction({
      account,
      date: '2026-08-19',
      note: '',
      parts: [{ category: food, amount: 50_000 }],
    }),
  ).rejects.toThrow()

  expect(await pb.collection('transactions').getFullList()).toEqual([])
})

it('creates nothing when one part is invalid', async () => {
  await createSignedInUser('sp')
  const { account, food, home } = await context()

  await expect(
    splitTransaction({
      account,
      date: '2026-08-19',
      note: '',
      parts: [
        { category: food, amount: 35_000 },
        { category: home, amount: 0 },
      ],
    }),
  ).rejects.toThrow()

  expect(await pb.collection('transactions').getFullList()).toEqual([])
  expect(await balanceOf(account)).toBe(150_000)
})

it('never splits onto another owner’s category', async () => {
  await createSignedInUser('victim')
  const theirCategories = await pb.collection('categories').getFullList<Category>()
  const theirs = theirCategories[0]!.id

  await createSignedInUser('intruder')
  const { account, food } = await context()

  await expect(
    splitTransaction({
      account,
      date: '2026-08-19',
      note: '',
      parts: [
        { category: food, amount: 10_000 },
        { category: theirs, amount: 5_000 },
      ],
    }),
  ).rejects.toThrow()

  expect(await pb.collection('transactions').getFullList()).toEqual([])
})

import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type AccountBalance, type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const TODAY = '2026-08-12 10:00:00'

async function anAccount(initialBalance: number) {
  return pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: initialBalance,
  })
}

async function aCategory() {
  return (await pb.collection('categories').getFullList<Category>())[0]!
}

async function record(account: string, type: string, amount: number, category?: string) {
  return pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category: category ?? '',
    type,
    amount,
    date: TODAY,
  })
}

const balanceOf = async (accountId: string) => {
  const rows = await pb.collection('account_balances').getFullList<AccountBalance>()

  return rows.find((row) => row.id === accountId)?.balance
}

beforeEach(() => {
  pb.authStore.clear()
})

// Balances are summed in SQLite rather than stored, so they can never drift
// from the transactions that make them up.
it('subtracts an expense from the account balance', async () => {
  await createSignedInUser('bal')
  const account = await anAccount(150_000)
  const category = await aCategory()

  await record(account.id, 'depense', 20_000, category.id)

  expect(await balanceOf(account.id)).toBe(130_000)
})

it('adds an income to the account balance', async () => {
  await createSignedInUser('bal')
  const account = await anAccount(150_000)
  const category = await aCategory()

  await record(account.id, 'revenu', 50_000, category.id)

  expect(await balanceOf(account.id)).toBe(200_000)
})

it('restores the balance when a transaction is deleted', async () => {
  await createSignedInUser('bal')
  const account = await anAccount(150_000)
  const category = await aCategory()

  const entry = await record(account.id, 'depense', 20_000, category.id)
  expect(await balanceOf(account.id)).toBe(130_000)

  await pb.collection('transactions').delete(entry.id)

  expect(await balanceOf(account.id)).toBe(150_000)
})

it('lets the balance go negative when spending exceeds the account', async () => {
  await createSignedInUser('bal')
  const account = await anAccount(10_000)
  const category = await aCategory()

  await record(account.id, 'depense', 12_000, category.id)

  expect(await balanceOf(account.id)).toBe(-2_000)
})

it('never counts another owner’s transactions', async () => {
  await createSignedInUser('mine')
  const mine = await anAccount(100_000)
  const category = await aCategory()
  await record(mine.id, 'depense', 30_000, category.id)

  await createSignedInUser('other')

  expect(await pb.collection('transactions').getFullList()).toEqual([])
  expect(await balanceOf(mine.id)).toBeUndefined()
})

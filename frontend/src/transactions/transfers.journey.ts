import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type AccountBalance, type Transaction } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'
import { transfer } from './transfers-api.ts'

async function anAccount(name: string, initialBalance: number) {
  return pb.collection('accounts').create({
    user: currentUserId(),
    name,
    type: 'banque',
    initial_balance: initialBalance,
  })
}

const balances = async () => {
  const rows = await pb.collection('account_balances').getFullList<AccountBalance>()

  return Object.fromEntries(rows.map((row) => [row.id, row.balance]))
}

beforeEach(() => {
  pb.authStore.clear()
})

// CPT-05: one operation, two linked rows, and no money created or destroyed.
it('moves money between two accounts without changing the total', async () => {
  await createSignedInUser('tf')
  const from = await anAccount('Compte courant', 150_000)
  const to = await anAccount('Épargne', 20_000)

  await transfer({ from: from.id, to: to.id, amount: 30_000, date: '2026-08-19' })

  const after = await balances()

  expect(after[from.id]).toBe(120_000)
  expect(after[to.id]).toBe(50_000)
  expect(after[from.id]! + after[to.id]!).toBe(170_000)
})

it('records exactly two linked rows', async () => {
  await createSignedInUser('tf')
  const from = await anAccount('Compte courant', 150_000)
  const to = await anAccount('Épargne', 20_000)

  await transfer({ from: from.id, to: to.id, amount: 30_000, date: '2026-08-19' })

  const rows = await pb.collection('transactions').getFullList<Transaction>()

  expect(rows).toHaveLength(2)
  expect(new Set(rows.map((row) => row.transfer_group)).size).toBe(1)
  expect(rows.map((row) => row.type).sort()).toEqual(['virement_entrant', 'virement_sortant'])
  expect(rows.every((row) => row.category === '')).toBe(true)
})

// The whole reason for a server route: a refused transfer must leave nothing
// behind, never a debit without its credit.
it('creates nothing at all when the destination is not the caller’s', async () => {
  await createSignedInUser('victim')
  const theirs = await anAccount('Compte de la victime', 10_000)

  await createSignedInUser('intruder')
  const mine = await anAccount('Compte propre', 50_000)

  await expect(
    transfer({ from: mine.id, to: theirs.id, amount: 5_000, date: '2026-08-19' }),
  ).rejects.toThrow()

  expect(await pb.collection('transactions').getFullList()).toEqual([])
  expect((await balances())[mine.id]).toBe(50_000)
})

it('refuses a transfer onto the same account', async () => {
  await createSignedInUser('tf')
  const only = await anAccount('Compte unique', 50_000)

  await expect(
    transfer({ from: only.id, to: only.id, amount: 5_000, date: '2026-08-19' }),
  ).rejects.toThrow()

  expect(await pb.collection('transactions').getFullList()).toEqual([])
})

it.each([0, -500])('refuses the amount %i', async (amount) => {
  await createSignedInUser('tf')
  const from = await anAccount('Compte courant', 150_000)
  const to = await anAccount('Épargne', 20_000)

  await expect(transfer({ from: from.id, to: to.id, amount, date: '2026-08-19' })).rejects.toThrow()

  expect(await pb.collection('transactions').getFullList()).toEqual([])
})

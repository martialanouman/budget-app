import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Category, type Transaction } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

/**
 * PocketBase's own stamp format, at a chosen age. The window is read from the
 * real clock inside the hook, so a test cannot move the deadline — it moves the
 * entry instead, through a probe that writes `created` straight to SQLite.
 */
const recordedDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().replace('T', ' ')

const backdate = (id: string, days: number) =>
  pb.send('/api/test/backdate-transaction', {
    method: 'POST',
    body: { id, created: recordedDaysAgo(days) },
  })

async function anEntry(amount = 12_000) {
  const owner = currentUserId()
  const account = await pb.collection('accounts').create({
    user: owner,
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 250_000,
  })
  const category = (await pb.collection('categories').getFullList<Category>())[0]!

  return pb.collection('transactions').create<Transaction>({
    user: owner,
    account: account.id,
    category: category.id,
    type: 'depense',
    amount,
    date: '2026-08-20 10:00:00',
  })
}

const amountOf = async (id: string) =>
  (await pb.collection('transactions').getOne<Transaction>(id)).amount

beforeEach(() => {
  pb.authStore.clear()
})

// TRX-05. A mistake found the same week is an ordinary correction.
it('lets an owner correct an entry inside the window', async () => {
  await createSignedInUser('window')
  const entry = await anEntry()

  await backdate(entry.id, 29)
  await pb.collection('transactions').update(entry.id, { amount: 15_000 })

  expect(await amountOf(entry.id)).toBe(15_000)
})

// The refusal is only worth having if the row is untouched afterwards: a hook
// that threw after e.next() would reject the call and keep the new figure.
it('refuses an edit past the thirty-day window', async () => {
  await createSignedInUser('window')
  const entry = await anEntry()

  await backdate(entry.id, 31)

  await expect(
    pb.collection('transactions').update(entry.id, { amount: 999_000 }),
  ).rejects.toThrow()
  expect(await amountOf(entry.id)).toBe(12_000)
})

// Deletion is held to the same deadline. Left open it would undo the rule in
// two clicks — remove the settled row, type it again at whatever figure suits.
it('refuses a deletion past the thirty-day window', async () => {
  await createSignedInUser('window')
  const entry = await anEntry()

  await backdate(entry.id, 31)

  await expect(pb.collection('transactions').delete(entry.id)).rejects.toThrow()
  expect(await amountOf(entry.id)).toBe(12_000)
})

// Decided on 30/08/2026: a split part is an autonomous expense that counts once
// everywhere, and nothing stores the purchase it came from — so editing one
// breaks no invariant. Written down as a test rather than left to the silence
// of the access rules, which only ever locked transfers.
it('edits one part of a split like any other line', async () => {
  await createSignedInUser('window')
  const entry = await anEntry()
  const category = (await pb.collection('categories').getFullList<Category>())[0]!

  await pb.send('/api/splits', {
    method: 'POST',
    body: {
      account: entry.account,
      date: '2026-08-22 09:00:00',
      note: 'Courses',
      parts: [
        { category: category.id, amount: 7_000 },
        { category: category.id, amount: 3_000 },
      ],
    },
  })

  const parts = await pb
    .collection('transactions')
    .getFullList<Transaction>({ filter: "split_group != ''" })

  await pb.collection('transactions').update(parts[0]!.id, { amount: 8_000 })

  expect(await amountOf(parts[0]!.id)).toBe(8_000)
})

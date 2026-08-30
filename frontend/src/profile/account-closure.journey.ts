import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

/** An owner with something of everything behind them. */
const aFurnishedAccount = async () => {
  const owner = currentUserId()!
  const account = await pb.collection('accounts').create({
    user: owner,
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 250_000,
  })
  const category = (await pb.collection('categories').getFullList<Category>())[0]!

  await pb.collection('transactions').create({
    user: owner,
    account: account.id,
    category: category.id,
    type: 'depense',
    amount: 12_000,
    date: '2026-08-20 10:00:00',
  })
  await pb.collection('budgets').create({
    user: owner,
    category: category.id,
    month: '2026-08',
    cap_amount: 80_000,
  })
  const debt = await pb.collection('debts').create({
    user: owner,
    creditor: 'Banque',
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 500_000,
    interest_rate: 0,
    monthly_payment: 50_000,
    due_day: 5,
    start_date: '2026-01-10',
    status: 'active',
  })
  await pb.collection('debt_payments').create({
    user: owner,
    debt: debt.id,
    amount: 50_000,
    date: '2026-02-05',
  })

  // The two shapes that carry delete-time hooks of their own, and the reason
  // this fixture is worth widening: a transfer's legs fall as a pair from
  // inside the delete hook, while the cascade is walking its own list of rows
  // to delete. USR-04 was blocked twice already by a hook meeting a cascade —
  // first the account relation, then a single debt repayment — and neither was
  // visible until the fixture reached it.
  const savings = await pb.collection('accounts').create({
    user: owner,
    name: 'Épargne',
    type: 'epargne',
    initial_balance: 100_000,
  })

  await pb.send('/api/transfers', {
    method: 'POST',
    body: { from: account.id, to: savings.id, amount: 30_000, date: '2026-08-21 09:00:00' },
  })

  await pb.send('/api/splits', {
    method: 'POST',
    body: {
      account: account.id,
      date: '2026-08-22 09:00:00',
      note: 'Courses',
      parts: [
        { category: category.id, amount: 7_000 },
        { category: category.id, amount: 3_000 },
      ],
    },
  })

  return owner
}

/** Row counts straight from the database, past the access rules. */
const rowsLeftOf = (owner: string) =>
  pb.send<Record<string, number>>('/api/test/owner-rows', { method: 'POST', body: { user: owner } })

beforeEach(() => {
  pb.authStore.clear()
})

// USR-04. transactions.account is required and was not cascading, so deleting
// an owner cascaded their accounts away while the entries still pointed at
// them, and PocketBase refused the whole thing: "Failed to delete record".
// Measured on 19/08/2026, and it made an account impossible to close at all.
it('lets an owner close an account that has a history behind it', async () => {
  await createSignedInUser('closing')
  const owner = await aFurnishedAccount()

  await expect(pb.collection('users').delete(owner)).resolves.toBe(true)
})

// The thirty-day window (TRX-05) is the third hook to meet this cascade, and
// the reason both its handlers are the *Request* variants. users cascades into
// transactions and PocketBase runs the model hooks for cascaded rows: on
// onRecordDelete, every entry older than a month would refuse to go, and
// closing an account would be impossible for anyone who had used the app for
// more than a month — which is to say, for everyone who would ever want to.
it('lets an owner close an account whose entries are older than the edit window', async () => {
  await createSignedInUser('closing')
  const owner = await aFurnishedAccount()

  const settled = new Date(Date.now() - 400 * 86_400_000).toISOString().replace('T', ' ')

  for (const entry of await pb.collection('transactions').getFullList()) {
    await pb.send('/api/test/backdate-transaction', {
      method: 'POST',
      body: { id: entry.id, created: settled },
    })
  }

  await expect(pb.collection('users').delete(owner)).resolves.toBe(true)
})

// Closing has to mean the data is gone, not merely hidden. Asking as another
// owner would prove nothing — the rules hide other people's rows either way —
// so this counts through a probe that sees the whole table.
it('leaves nothing of the owner behind', async () => {
  await createSignedInUser('closing')
  const owner = await aFurnishedAccount()

  // Guards against a vacuous pass: if the fixture wrote nothing, deleting it
  // would prove nothing. Notifications are absent on purpose — a 12 000 spend
  // against an 80 000 cap crosses no threshold.
  const before = await rowsLeftOf(owner)
  expect(
    Object.entries(before)
      .filter(([collection]) => collection !== 'notifications')
      .every(([, count]) => count > 0),
  ).toBe(true)

  await pb.collection('users').delete(owner)
  await createSignedInUser('witness')

  expect(await rowsLeftOf(owner)).toEqual({
    accounts: 0,
    categories: 0,
    transactions: 0,
    budgets: 0,
    debts: 0,
    debt_payments: 0,
    notifications: 0,
  })
})

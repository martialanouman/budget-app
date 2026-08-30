import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Category, type Notification } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'
import { splitTransaction } from '@/transactions/splits-api.ts'

const month = () => monthOf(todayLocally())

async function context(cap: number) {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 500_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()
  const food = categories.find((one) => one.name === 'Alimentation')!.id

  await pb.collection('budgets').create({
    user: currentUserId(),
    month: month(),
    category: food,
    cap_amount: cap,
    carry_over: false,
    carried_amount: 0,
  })

  return { account: account.id, food }
}

const spend = (account: string, category: string, amount: number) =>
  pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category,
    type: 'depense',
    amount,
    date: todayLocally(),
    note: '',
  })

const alerts = async () => {
  const rows = await pb.collection('notifications').getFullList<Notification>()

  return rows.map((row) => row.payload)
}

beforeEach(() => {
  pb.authStore.clear()
})

// NOT-02 and BUD-04. The alert belongs to the threshold, not to the entry that
// happened to cross it: every later expense would otherwise ring again.
it('alerts once per threshold, not once per expense beyond it', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  await spend(account, food, 85_000)

  expect(await alerts()).toEqual([{ month: month(), category: food, threshold: 80 }])

  await spend(account, food, 5_000)

  expect(await alerts()).toHaveLength(1)

  await spend(account, food, 20_000)

  expect(await alerts()).toEqual([
    { month: month(), category: food, threshold: 80 },
    { month: month(), category: food, threshold: 100 },
  ])
})

// A single large expense crosses both at once and owes an alert for each.
it('alerts for both thresholds crossed by one expense', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  await spend(account, food, 150_000)

  expect(await alerts()).toHaveLength(2)
})

it('says nothing about a category with no envelope', async () => {
  await createSignedInUser('al')
  const { account } = await context(100_000)
  const categories = await pb.collection('categories').getFullList<Category>()

  await spend(account, categories.find((one) => one.name === 'Transport')!.id, 900_000)

  expect(await alerts()).toEqual([])
})

// An envelope is about spending: income must never trip it.
it('says nothing about income', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  await pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category: food,
    type: 'revenu',
    amount: 300_000,
    date: todayLocally(),
    note: '',
  })

  expect(await alerts()).toEqual([])
})

// A split is written by the server route inside one transaction. Its rows are
// ordinary spending and must trip the envelope like any other.
it('alerts on spending typed as a split', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)
  const categories = await pb.collection('categories').getFullList<Category>()

  await splitTransaction({
    account,
    date: todayLocally(),
    note: 'Courses',
    parts: [
      { category: food, amount: 90_000 },
      { category: categories.find((one) => one.name === 'Transport')!.id, amount: 10_000 },
    ],
  })

  expect(await alerts()).toEqual([{ month: month(), category: food, threshold: 80 }])
})

// An entry can be corrected. The alert belongs to the state of the envelope,
// not to the moment an entry happened to be typed.
it('raises the alert when an expense is corrected upwards', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  const entry = await spend(account, food, 50_000)

  expect(await alerts()).toEqual([])

  await pb.collection('transactions').update(entry.id, { amount: 95_000 })

  expect(await alerts()).toEqual([{ month: month(), category: food, threshold: 80 }])
})

// Deleting the entry that tripped the threshold takes the alert back with it:
// leaving it would show a warning about spending that no longer exists, and
// the per-threshold dedupe would forbid ever raising it again.
it('takes the alert back when the expense behind it is deleted', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  const entry = await spend(account, food, 85_000)

  expect(await alerts()).toHaveLength(1)

  await pb.collection('transactions').delete(entry.id)

  expect(await alerts()).toEqual([])
})

// A dismissed alert is history: it stays on file even once the spending that
// justified it is gone.
it('leaves an alert the user has already dismissed', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  const entry = await spend(account, food, 85_000)
  const [raised] = await pb.collection('notifications').getFullList<Notification>()

  await pb.collection('notifications').update(raised!.id, { read: true })
  await pb.collection('transactions').delete(entry.id)

  expect(await pb.collection('notifications').getFullList()).toHaveLength(1)
})

// Moving an expense to another category must clear the envelope it left.
it('takes the alert back when the expense moves to another category', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)
  const categories = await pb.collection('categories').getFullList<Category>()

  const entry = await spend(account, food, 85_000)

  expect(await alerts()).toHaveLength(1)

  await pb.collection('transactions').update(entry.id, {
    category: categories.find((one) => one.name === 'Transport')!.id,
  })

  expect(await alerts()).toEqual([])
})

// The envelope is half of the question the alert answers, and until now only
// the other half asked it: the reconciliation ran on every write to a
// transaction and on none to a budget. Someone who sets a ceiling on a
// category they have already spent on — the ordinary way of discovering one
// spends too much on it — was told nothing until their next expense.
it('alerts as soon as a ceiling is set below what is already spent', async () => {
  await createSignedInUser('al')
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 500_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()
  const food = categories.find((one) => one.name === 'Alimentation')!.id

  await spend(account.id, food, 90_000)

  expect(await alerts()).toEqual([])

  await pb.collection('budgets').create({
    user: currentUserId(),
    month: month(),
    category: food,
    cap_amount: 100_000,
    carry_over: false,
    carried_amount: 0,
  })

  expect(await alerts()).toEqual([{ month: month(), category: food, threshold: 80 }])
})

// Raising the ceiling is the user answering the alert. Leaving it up would
// show a warning about a threshold the envelope no longer stands at.
it('withdraws the alert when the ceiling is raised above the spending', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  await spend(account, food, 85_000)

  expect(await alerts()).toHaveLength(1)

  const [envelope] = await pb.collection('budgets').getFullList()

  await pb.collection('budgets').update(envelope!.id, { cap_amount: 200_000 })

  expect(await alerts()).toEqual([])
})

// Without an envelope there is no threshold to stand at, and the screen no
// longer shows the figure the warning refers to.
it('withdraws the alert when the envelope itself is removed', async () => {
  await createSignedInUser('al')
  const { account, food } = await context(100_000)

  await spend(account, food, 85_000)

  expect(await alerts()).toHaveLength(1)

  const [envelope] = await pb.collection('budgets').getFullList()

  await pb.collection('budgets').delete(envelope!.id)

  expect(await alerts()).toEqual([])
})

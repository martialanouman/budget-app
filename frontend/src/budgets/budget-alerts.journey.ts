import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Category, type Notification } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

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

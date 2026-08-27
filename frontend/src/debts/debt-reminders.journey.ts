import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Debt, type Notification } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const aDebt = (dueDay: number, fields: Record<string, unknown> = {}) =>
  pb.collection('debts').create<Debt>({
    user: currentUserId(),
    creditor: `Créancier ${dueDay}`,
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 500_000,
    interest_rate: 0,
    monthly_payment: 50_000,
    due_day: dueDay,
    start_date: '2026-01-10',
    status: 'active',
    ...fields,
  })

/** The reminders job, run for a day the test pins rather than for today. */
const runFor = (today: string) =>
  pb.send('/api/test/remind-debt-dues', { method: 'POST', body: { today } })

const reminders = async () => {
  const rows = await pb.collection('notifications').getFullList<Notification>({
    filter: "type = 'echeance_dette'",
  })

  return rows.map((row) => row.subject).sort()
}

beforeEach(() => {
  pb.authStore.clear()
})

// DET-04 / NOT-01: three days before, the day before, and the day itself.
it('reminds three days before, the day before, and on the day', async () => {
  await createSignedInUser('rm')
  const three = await aDebt(14)
  const one = await aDebt(12)
  const today = await aDebt(11)
  await aDebt(20)

  await runFor('2026-08-11')

  expect(await reminders()).toEqual(
    [`2026-08-14@${three.id}@3`, `2026-08-12@${one.id}@1`, `2026-08-11@${today.id}@0`].sort(),
  )
})

// The job runs every morning: a second pass must not ring twice for the same
// instalment.
it('never reminds twice for the same instalment', async () => {
  await createSignedInUser('rm')
  await aDebt(11)

  await runFor('2026-08-11')
  await runFor('2026-08-11')

  expect(await reminders()).toHaveLength(1)
})

// A settled debt has no instalment left to announce.
it('says nothing about a settled debt', async () => {
  await createSignedInUser('rm')
  await aDebt(11, { status: 'soldee' })

  await runFor('2026-08-11')

  expect(await reminders()).toEqual([])
})

// DET-02: money owed to the user has due dates too, and they are worth
// remembering — that is when to ask.
it('reminds about money owed to the user as well', async () => {
  await createSignedInUser('rm')
  const owed = await aDebt(11, { direction: 'on_me_doit', creditor: 'Kouassi' })

  await runFor('2026-08-11')

  expect(await reminders()).toEqual([`2026-08-11@${owed.id}@0`])
})

it('never reminds one owner about another’s debt', async () => {
  await createSignedInUser('victim')
  await aDebt(11)

  await createSignedInUser('watcher')

  await runFor('2026-08-11')

  expect(await reminders()).toEqual([])
})

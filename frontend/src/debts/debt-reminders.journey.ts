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

const reminders = async (filter = "type = 'echeance_dette'") => {
  const rows = await pb.collection('notifications').getFullList<Notification>({ filter })

  return rows.map((row) => row.subject).sort()
}

const unread = () => reminders("type = 'echeance_dette' && read = false")

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

// A settled debt has no instalment left to announce. Settled the way a debt
// actually is — by repaying it — since the status is the server's to write.
it('says nothing about a settled debt', async () => {
  await createSignedInUser('rm')
  const debt = await aDebt(11, { initial_amount: 50_000, monthly_payment: 50_000 })

  await pb.collection('debt_payments').create({
    user: currentUserId(),
    debt: debt.id,
    amount: 50_000,
    date: '2026-02-05',
  })

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

// The schedule on screen places the first instalment in the month after the
// debt starts. The reminders counted from the due day alone, so a debt opened
// today announced an instalment the app itself said was a month away.
it('never announces an instalment before the debt has started', async () => {
  await createSignedInUser('rm')
  await aDebt(14, { start_date: '2026-08-20' })

  await runFor('2026-08-11')

  expect(await reminders()).toEqual([])
})

it('announces the first instalment of the month after the start', async () => {
  await createSignedInUser('rm')
  const debt = await aDebt(14, { start_date: '2026-08-01' })

  await runFor('2026-09-11')

  expect(await reminders()).toEqual([`2026-09-14@${debt.id}@3`])
})

// Three offsets for one instalment used to stack three cards on the day it
// fell, each still claiming the number of days it was written with. The nearer
// reminder is the only one worth reading; the earlier ones stay as history.
it('lets the nearer reminder retire the earlier one', async () => {
  await createSignedInUser('rm')
  const debt = await aDebt(14)

  await runFor('2026-08-11')
  await runFor('2026-08-13')
  await runFor('2026-08-14')

  expect(await unread()).toEqual([`2026-08-14@${debt.id}@0`])
  expect(await reminders()).toHaveLength(3)
})

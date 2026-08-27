import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Debt, type DebtPayment } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const aDebt = (fields: Record<string, unknown> = {}) =>
  pb.collection('debts').create<Debt>({
    user: currentUserId(),
    creditor: 'Banque Atlantique',
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 1_000_000,
    interest_rate: 12,
    monthly_payment: 90_000,
    due_day: 5,
    start_date: '2026-01-10',
    status: 'active',
    ...fields,
  })

const aPayment = (debt: string, amount: number, date: string, fields = {}) =>
  pb.collection('debt_payments').create<DebtPayment>({
    user: currentUserId(),
    debt,
    amount,
    date,
    ...fields,
  })

const remainingOf = async (id: string) =>
  (await pb.collection('debts').getOne<Debt>(id)).remaining_amount

beforeEach(() => {
  pb.authStore.clear()
})

// DET-03: a repayment takes the month's interest first, and only what is left
// comes off the capital.
it('reduces the capital by what the repayment actually repays', async () => {
  await createSignedInUser('db')
  const debt = await aDebt()

  const payment = await aPayment(debt.id, 90_000, '2026-02-05')

  expect(payment.interest_part).toBe(10_000)
  expect(payment.principal_part).toBe(80_000)
  expect(await remainingOf(debt.id)).toBe(920_000)
})

// The DoD of this step: a correction replays the history rather than undoing
// a figure. Re-incrementing blindly would leave the capital wrong for good.
it('replays the history when a repayment is deleted', async () => {
  await createSignedInUser('db')
  const debt = await aDebt()

  await aPayment(debt.id, 90_000, '2026-02-05')
  const mistake = await aPayment(debt.id, 90_000, '2026-03-05')

  expect(await remainingOf(debt.id)).toBeLessThan(920_000)

  await pb.collection('debt_payments').delete(mistake.id)

  expect(await remainingOf(debt.id)).toBe(920_000)
})

// Correcting an early repayment changes what every later one repaid: their
// interest was computed on a capital that has just moved.
it('recomputes the later repayments when an earlier one is corrected', async () => {
  await createSignedInUser('db')
  const debt = await aDebt()

  const first = await aPayment(debt.id, 90_000, '2026-02-05')
  await aPayment(debt.id, 90_000, '2026-03-05')

  await pb.collection('debt_payments').update(first.id, { amount: 190_000 })

  const payments = await pb.collection('debt_payments').getFullList<DebtPayment>({ sort: 'date' })

  expect(payments[0]!.principal_part).toBe(180_000)
  // Interest on 820 000 rather than on 920 000: the later payment repays more.
  expect(payments[1]!.interest_part).toBe(8_200)
  expect(await remainingOf(debt.id)).toBe(1_000_000 - 180_000 - (90_000 - 8_200))
})

it('marks a debt as settled once nothing is left', async () => {
  await createSignedInUser('db')
  const debt = await aDebt({ initial_amount: 50_000, interest_rate: 0, monthly_payment: 50_000 })

  await aPayment(debt.id, 50_000, '2026-02-05')

  const settled = await pb.collection('debts').getOne<Debt>(debt.id)

  expect(settled.remaining_amount).toBe(0)
  expect(settled.status).toBe('soldee')
})

// DET-02: money owed to the user amortises exactly the same way.
it('treats money owed to the user symmetrically', async () => {
  await createSignedInUser('db')
  const debt = await aDebt({
    direction: 'on_me_doit',
    creditor: 'Kouassi',
    kind: 'familiale',
    initial_amount: 100_000,
    interest_rate: 0,
    monthly_payment: 25_000,
  })

  await aPayment(debt.id, 25_000, '2026-02-05')

  expect(await remainingOf(debt.id)).toBe(75_000)
})

// The split depends on what was owed when the payment landed — a figure the
// client has no business stating.
it('ignores a split stated by the client', async () => {
  await createSignedInUser('db')
  const debt = await aDebt()

  const forged = await aPayment(debt.id, 90_000, '2026-02-05', {
    principal_part: 90_000,
    interest_part: 0,
  })

  expect(forged.interest_part).toBe(10_000)
  expect(await remainingOf(debt.id)).toBe(920_000)
})

it('never records a repayment against another owner’s debt', async () => {
  await createSignedInUser('victim')
  const theirs = await aDebt()

  await createSignedInUser('intruder')
  const mine = await aDebt()

  await expect(aPayment(theirs.id, 10_000, '2026-02-05')).rejects.toThrow()

  const payment = await aPayment(mine.id, 10_000, '2026-02-05')

  await expect(
    pb.collection('debt_payments').update(payment.id, { debt: theirs.id }),
  ).rejects.toThrow()
})

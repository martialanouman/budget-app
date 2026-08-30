import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Debt } from '@/lib/collections'
import { dayLabel, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(amount.replace(/ /gu, '\\s'), 'u')

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

/** The month after this one, on the given day — the first instalment to come. */
function nextMonthOn(day: number) {
  const [year, month] = todayLocally().split('-').map(Number) as [number, number]
  const absolute = year * 12 + month

  return `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

beforeEach(() => {
  pb.authStore.clear()
})

// DET-03 and DET-08 end to end: the repayment is typed on the screen, and the
// capital that falls is the one the server replayed.
it('records a repayment and shows the capital falling', async () => {
  await createSignedInUser('dt')
  await aDebt()

  const { screen } = await renderApp('/debts')

  await screen.getByRole('link', { name: /Banque Atlantique/u }).click()

  await screen.getByLabelText('Montant remboursé').fill('90 000')
  await screen.getByRole('button', { name: 'Enregistrer le remboursement' }).click()

  await expect.element(screen.getByText(xof('920 000'))).toBeVisible()
  // DET-08: the history keeps what each repayment actually repaid.
  await expect.element(screen.getByText(xof('10 000'))).toBeVisible()
})

// DET-05: when the debt ends, counted from what is still owed rather than
// from what was borrowed.
it('estimates the end date from what is still owed', async () => {
  await createSignedInUser('dt')
  await aDebt({ initial_amount: 100_000, interest_rate: 0, monthly_payment: 100_000, due_day: 5 })

  const { screen } = await renderApp('/debts')

  await expect.element(screen.getByText(new RegExp(dayLabel(nextMonthOn(5)), 'u'))).toBeVisible()
})

// DET-05: what the debts weigh, and what share of the month's income goes to
// them. Both are money questions the dashboard has to answer at a glance.
it('sums what is owed and the share of income it takes', async () => {
  await createSignedInUser('dt')
  // Two owed debts, so the total is a figure no single row shows.
  await aDebt({ initial_amount: 500_000, interest_rate: 0, monthly_payment: 100_000 })
  await aDebt({
    creditor: 'Crédit du Sud',
    initial_amount: 300_000,
    interest_rate: 0,
    monthly_payment: 100_000,
  })
  await aDebt({
    creditor: 'Kouassi',
    kind: 'familiale',
    direction: 'on_me_doit',
    initial_amount: 200_000,
    interest_rate: 0,
    monthly_payment: 50_000,
  })

  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 0,
  })

  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: '',
    type: 'revenu',
    amount: 400_000,
    date: todayLocally(),
    note: 'Salaire',
  })

  const { screen } = await renderApp('/debts')

  // Only what the user owes counts as debt; the 200 000 owed to them does not.
  await expect.element(screen.getByText(xof('800 000'))).toBeVisible()
  await expect.element(screen.getByText('50 % des revenus du mois')).toBeVisible()
})

it('records a new debt from the form', async () => {
  await createSignedInUser('dt')

  const { screen } = await renderApp('/debts')

  await screen.getByLabelText('Créancier').fill('Tontine du quartier')
  await screen.getByLabelText('Montant emprunté').fill('300 000')
  await screen.getByLabelText('Mensualité').fill('50 000')
  await screen.getByLabelText('Jour d’échéance').fill('10')
  await screen.getByLabelText('Type').selectOptions('Tontine')
  await screen.getByRole('button', { name: 'Ajouter la dette' }).click()

  await expect.element(screen.getByRole('link', { name: /Tontine du quartier/u })).toBeVisible()
})

// DET-03: the schedule is generated, not typed.
it('shows the schedule of instalments to come', async () => {
  await createSignedInUser('dt')
  await aDebt({ initial_amount: 300_000, interest_rate: 0, monthly_payment: 100_000 })

  const { screen } = await renderApp('/debts')

  await screen.getByRole('link', { name: /Banque Atlantique/u }).click()

  await expect.element(screen.getByRole('heading', { name: 'Échéancier' })).toBeVisible()
  await expect.element(screen.getByText(new RegExp(dayLabel(nextMonthOn(5)), 'u'))).toBeVisible()
})

// `remaining_amount || initial_amount` tested a falsy value rather than an
// absent one, and zero is falsy: a debt repaid to the last franc went back to
// displaying what had been borrowed, with a full schedule to come.
it('shows nothing left on a debt that has been repaid', async () => {
  await createSignedInUser('dt')
  const debt = await aDebt({ initial_amount: 50_000, interest_rate: 0, monthly_payment: 50_000 })

  await pb.collection('debt_payments').create({
    user: currentUserId(),
    debt: debt.id,
    amount: 50_000,
    date: '2026-02-05',
  })

  const { screen } = await renderApp('/debts')

  await expect.element(screen.getByText(/soldée/u)).toBeVisible()
  // Scoped to the row: the total shows zero too, for the different reason
  // that a settled debt no longer weighs on anything.
  await expect.element(screen.getByRole('listitem').getByText(xof('0 F CFA'))).toBeVisible()

  await screen.getByRole('link', { name: /Banque Atlantique/u }).click()

  await expect
    .element(screen.getByText('Aucune échéance à venir : la dette est soldée.'))
    .toBeVisible()
})

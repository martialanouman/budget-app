import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category, type Debt } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(amount.replace(/ /gu, '\\s'), 'u')

async function anAccount(initialBalance: number) {
  return pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: initialBalance,
  })
}

const categoryNamed = async (name: string) => {
  const categories = await pb.collection('categories').getFullList<Category>()

  return categories.find((one) => one.name === name)!.id
}

const spend = async (account: string, category: string, amount: number) =>
  pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category,
    type: 'depense',
    amount,
    date: todayLocally(),
    note: '',
  })

beforeEach(() => {
  pb.authStore.clear()
})

// RAP-01: the screen that answers "where do I stand" without a click.
it('answers where the user stands in one screen', async () => {
  await createSignedInUser('db')
  const account = await anAccount(600_000)
  const food = await categoryNamed('Alimentation')

  await spend(account.id, food, 120_000)
  await pb.collection('budgets').create({
    user: currentUserId(),
    month: monthOf(todayLocally()),
    category: food,
    cap_amount: 200_000,
    carry_over: false,
    carried_amount: 0,
  })

  const { screen } = await renderApp('/')

  // Total balance across accounts: 600 000 less the 120 000 spent.
  await expect.element(screen.getByText(xof('480 000'))).toBeVisible()
  // The spend and the ceiling it is measured against, now two elements rather
  // than one sentence: side by side the two amounts wrapped mid-line on a phone
  // and read as a single broken number. Scoped to their own figure, since the
  // same amount appears again in the breakdown below.
  const spending = screen.getByRole('region', { name: 'Dépenses du mois' })

  await expect.element(spending.getByText(xof('120 000'))).toBeVisible()
  await expect
    .element(spending.getByText(new RegExp(`sur.+${xof('200 000').source}.+enveloppes`, 'u')))
    .toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Reste à vivre' })).toBeVisible()
})

// The DoD of this step: what was just typed is what the dashboard shows —
// without leaving it, now that the entry sheet opens from anywhere (TRX-01).
it('reflects an expense typed a moment ago', async () => {
  await createSignedInUser('db')
  await anAccount(500_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText(xof('500 000'))).toBeVisible()

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByLabelText('Montant').fill('75 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText(xof('425 000'))).toBeVisible()
})

// RAP-01: where the money actually went, ranked. Five named at most — a list of
// twenty is not a glance — and the rest gathered rather than dropped, so the
// ring beside the legend still adds up to the month (RAP-02).
//
// Seven categories against six rows is what makes the cap discriminating: with
// six of each, six rows would prove nothing.
it('names at most five categories and gathers the rest', async () => {
  await createSignedInUser('db')
  const account = await anAccount(1_000_000)

  for (const [name, amount] of [
    ['Alimentation', 60_000],
    ['Transport', 50_000],
    ['Santé', 40_000],
    ['Loisirs', 30_000],
    ['Famille', 20_000],
    ['Autre', 10_000],
    ['Éducation', 5_000],
  ] as const) {
    await spend(account.id, await categoryNamed(name), amount)
  }

  const { screen } = await renderApp('/')

  const legend = screen.getByRole('list', { name: 'Répartition des dépenses' })

  await expect.element(legend.getByRole('listitem').first()).toHaveTextContent(/Alimentation/u)
  await expect
    .element(legend.getByRole('listitem').nth(5))
    .toHaveTextContent(new RegExp(`Autres catégories.*${xof('15 000').source}`, 'u'))

  expect(legend.getByRole('listitem').elements()).toHaveLength(6)
})

// RAP-01 again: what falls due next, so nothing is missed by inattention.
it('announces the instalments coming up', async () => {
  await createSignedInUser('db')
  await anAccount(0)
  await pb.collection('debts').create<Debt>({
    user: currentUserId(),
    creditor: 'Banque Atlantique',
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 900_000,
    interest_rate: 0,
    monthly_payment: 90_000,
    due_day: 5,
    start_date: '2026-01-10',
    status: 'active',
  })

  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('heading', { name: 'Prochaines échéances' })).toBeVisible()
  await expect.element(screen.getByText(/Banque Atlantique/u)).toBeVisible()
})

// BUD-05 counts the debt instalments, and the dashboard is where the debts are
// loaded: the figure that decides a spend must not ignore what is already
// promised to a lender.
it('holds back the instalments still to pay this month', async () => {
  await createSignedInUser('db')
  const account = await anAccount(0)

  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: await categoryNamed('Autre'),
    type: 'revenu',
    amount: 500_000,
    date: todayLocally(),
    note: '',
  })

  await pb.collection('debts').create<Debt>({
    user: currentUserId(),
    creditor: 'Banque Atlantique',
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 900_000,
    interest_rate: 0,
    monthly_payment: 90_000,
    due_day: 5,
    start_date: '2026-01-10',
    status: 'active',
  })

  const { screen } = await renderApp('/')

  // 500 000 earned, nothing spent, 90 000 owed to the lender this month.
  await expect.element(screen.getByText(xof('410 000'))).toBeVisible()
})

// DET-02 on the dashboard: money owed to the user falls due too, and reading
// it as one more thing to pay is the opposite of the truth.
it('tells an instalment to pay apart from one to receive', async () => {
  await createSignedInUser('db')
  await anAccount(0)
  await pb.collection('debts').create<Debt>({
    user: currentUserId(),
    creditor: 'Kouassi',
    kind: 'familiale',
    direction: 'on_me_doit',
    initial_amount: 200_000,
    interest_rate: 0,
    monthly_payment: 20_000,
    due_day: 5,
    start_date: '2026-01-10',
    status: 'active',
  })

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText(/À recevoir le/u)).toBeVisible()
})

// The reminder was written on the morning the cron ran and carries the day
// count of that morning. Read back three days later it claimed the instalment
// was still three days away, on the very day it fell.
it('counts the days to an instalment from today, not from the day it was announced', async () => {
  await createSignedInUser('db')
  await anAccount(0)

  const today = todayLocally()
  const dueDay = Number(today.slice(8, 10))

  await pb.collection('debts').create<Debt>({
    user: currentUserId(),
    creditor: 'Banque Atlantique',
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 900_000,
    interest_rate: 0,
    monthly_payment: 90_000,
    due_day: dueDay,
    start_date: '2026-01-10',
    status: 'active',
  })

  const announcedOn = new Date(`${today}T00:00:00`)
  announcedOn.setDate(announcedOn.getDate() - 3)

  await pb.send('/api/test/remind-debt-dues', {
    method: 'POST',
    body: { today: announcedOn.toISOString().slice(0, 10) },
  })

  const { screen } = await renderApp('/')

  await expect
    .element(screen.getByRole('button', { name: /Marquer comme lue.+aujourd'hui/u }))
    .toBeVisible()
})

// The accounts screen already holds this policy: a figure that could not be
// read is shown as missing. A confident zero on the very numbers a spend is
// decided on would be worse than an admission.
//
// The reads are made to fail for real — the server is simply not there — which
// is the only way to reach the policy from a journey. The earlier version of
// this test corrupted the session token instead, and it passed for a reason
// that was not the one it claimed: **PocketBase answers an unrecognised token
// with HTTP 200 and an empty list**, measured on 30/08/2026, so nothing failed
// at all. It caught the loading frame, where no figure has been read yet, and
// never reached the state it named. A revoked session still shows zeros; that
// gap needs the session refuted at start-up, not a dashboard change.
it('admits it could not read a figure rather than showing a zero', async () => {
  await createSignedInUser('db')
  await anAccount(600_000)

  const reachable = pb.baseURL
  pb.baseURL = 'http://127.0.0.1:1'

  try {
    const { screen } = await renderApp('/')

    await expect.element(screen.getByText('—').first()).toBeVisible()
    await expect.element(screen.getByText(xof('600 000'))).not.toBeInTheDocument()
    // The defect this holds: not a missing figure, but a confident zero.
    await expect.element(screen.getByText(/^0\sF\sCFA$/u)).not.toBeInTheDocument()
  } finally {
    pb.baseURL = reachable
  }
})

// CPT-04: an archived account can no longer be spent from nor transferred to,
// so counting it in the headline would announce money this screen cannot
// reach.
it('leaves an archived account out of the headline total', async () => {
  await createSignedInUser('db')
  await anAccount(600_000)
  const closed = await anAccount(250_000)

  await pb.collection('accounts').update(closed.id, { archived: true })

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText(xof('600 000'))).toBeVisible()
  await expect.element(screen.getByText(xof('850 000'))).not.toBeInTheDocument()
})

/**
 * Every figure on this screen is derived server-side — three views and a
 * streak — and no realtime channel pushes any of them. So a write has to say
 * which ones it invalidates, or the screen keeps answering with what it read
 * before the user typed.
 *
 * Measured before the fix: recording twenty thousand francs from this very
 * screen moved the balance and nothing else. "Dépenses du mois" still read
 * 0 F CFA, "Reste à vivre" still read 0 F CFA, and the streak still said there
 * was none — while the entry sat in the database.
 *
 * Starting from an empty month is what makes all three discriminating: a single
 * seeded entry would already have opened the streak and filled the totals.
 */
it('moves every derived figure when an entry is made from the dashboard', async () => {
  await createSignedInUser('db')
  await anAccount(500_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText('Aucune série en cours')).toBeVisible()

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByLabelText('Montant', { exact: true }).fill('20 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect
    .element(screen.getByRole('region', { name: 'Dépenses du mois' }).getByText(xof('20 000')))
    .toBeVisible()
  // No income this month, so what is left to live on is what was just spent.
  await expect
    .element(screen.getByRole('region', { name: 'Reste à vivre' }).getByText(xof('-20 000')))
    .toBeVisible()
  await expect.element(screen.getByText('1 jour d’affilée')).toBeVisible()
})

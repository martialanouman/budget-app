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
  await expect
    .element(
      screen.getByText(new RegExp(`${xof('120 000').source}.+${xof('200 000').source}`, 'u')),
    )
    .toBeVisible()
  await expect.element(screen.getByRole('heading', { name: 'Reste à vivre' })).toBeVisible()
})

// The DoD of this step: what was just typed is what the dashboard shows.
it('reflects an expense typed a moment ago', async () => {
  await createSignedInUser('db')
  await anAccount(500_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText(xof('500 000'))).toBeVisible()

  await screen.getByRole('link', { name: 'Transactions' }).click()
  await screen.getByLabelText('Montant').fill('75 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await screen.getByRole('link', { name: 'Accueil' }).click()

  await expect.element(screen.getByText(xof('425 000'))).toBeVisible()
})

// RAP-01: where the money actually went, ranked. Five at most — a list of
// twenty is not a glance.
it('ranks the five categories that spent the most', async () => {
  await createSignedInUser('db')
  const account = await anAccount(1_000_000)

  for (const [name, amount] of [
    ['Alimentation', 60_000],
    ['Transport', 50_000],
    ['Santé', 40_000],
    ['Loisirs', 30_000],
    ['Famille', 20_000],
    ['Autre', 10_000],
  ] as const) {
    await spend(account.id, await categoryNamed(name), amount)
  }

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText('Alimentation')).toBeVisible()
  await expect.element(screen.getByText('Famille')).toBeVisible()
  await expect.element(screen.getByText('Autre')).not.toBeInTheDocument()
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

import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { monthOf, previousMonth, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => amount.replace(/ /gu, '\\s')

async function spend(amount: number, categoryName: string, date = todayLocally()) {
  const account = await pb
    .collection('accounts')
    .getFullList()
    .then((rows) => rows[0])
  const categories = await pb.collection('categories').getFullList<Category>()

  return pb.collection('transactions').create({
    user: currentUserId(),
    account: account!.id,
    category: categories.find((one) => one.name === categoryName)!.id,
    type: 'depense',
    amount,
    date,
    note: '',
  })
}

async function anAccount() {
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 500_000,
  })
}

beforeEach(() => {
  pb.authStore.clear()
})

// BUD-01 and BUD-03: an envelope per category, and what it has consumed read
// back from the entries themselves.
it('sets a cap on a category and shows what is left', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await spend(30_000, 'Alimentation')

  const { screen } = await renderApp('/budgets')

  await screen.getByLabelText('Catégorie').selectOptions('Alimentation')
  await screen.getByLabelText('Plafond mensuel').fill('100 000')
  await screen.getByRole('button', { name: 'Définir le plafond' }).click()

  await expect
    .element(screen.getByText(new RegExp(`${xof('30 000')}.+${xof('100 000')}`, 'u')))
    .toBeVisible()
  await expect.element(screen.getByText(new RegExp(`Reste ${xof('70 000')}`, 'u'))).toBeVisible()
})

// BUD-04: the alert is a written statement, not a colour — colour alone would
// say nothing to a screen reader or to someone who cannot tell red from amber.
it('announces the 80 % threshold in words', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await spend(80_000, 'Alimentation')

  const { screen } = await renderApp('/budgets')

  await screen.getByLabelText('Catégorie').selectOptions('Alimentation')
  await screen.getByLabelText('Plafond mensuel').fill('100 000')
  await screen.getByRole('button', { name: 'Définir le plafond' }).click()

  await expect.element(screen.getByText('Seuil de 80 % atteint')).toBeVisible()
})

it('says when the cap is exceeded', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await spend(120_000, 'Alimentation')

  const { screen } = await renderApp('/budgets')

  await screen.getByLabelText('Catégorie').selectOptions('Alimentation')
  await screen.getByLabelText('Plafond mensuel').fill('100 000')
  await screen.getByRole('button', { name: 'Définir le plafond' }).click()

  await expect.element(screen.getByText('Plafond dépassé')).toBeVisible()
})

// Spending from another month belongs to that month's envelope, not this one.
it('counts only the month on screen', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await spend(30_000, 'Alimentation')
  await spend(90_000, 'Alimentation', '2026-01-15')

  const { screen } = await renderApp('/budgets')

  await screen.getByLabelText('Catégorie').selectOptions('Alimentation')
  await screen.getByLabelText('Plafond mensuel').fill('100 000')
  await screen.getByRole('button', { name: 'Définir le plafond' }).click()

  await expect.element(screen.getByText(new RegExp(`Reste ${xof('70 000')}`, 'u'))).toBeVisible()
})

const anEnvelope = async (month: string, categoryName: string, cap: number) => {
  const categories = await pb.collection('categories').getFullList<Category>()

  return pb.collection('budgets').create({
    user: currentUserId(),
    month,
    category: categories.find((one) => one.name === categoryName)!.id,
    cap_amount: cap,
    carry_over: false,
    carried_amount: 0,
  })
}

// BUD-02: a month starts from the previous one in a click.
it('fills the month from the previous one', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await anEnvelope(previousMonth(monthOf(todayLocally())), 'Alimentation', 120_000)

  const { screen } = await renderApp('/budgets')

  await expect.element(screen.getByText('Aucune enveloppe pour ce mois.')).toBeVisible()
  await screen.getByRole('button', { name: 'Dupliquer le mois précédent' }).click()

  await expect.element(screen.getByRole('heading', { name: 'Alimentation' })).toBeVisible()
  await expect.element(screen.getByText(new RegExp(`Reste ${xof('120 000')}`, 'u'))).toBeVisible()
})

// The click is meant to fill an empty month. Overwriting a cap someone has
// just adjusted would silently undo their work.
it('leaves an envelope already set for the month alone', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await anEnvelope(previousMonth(monthOf(todayLocally())), 'Alimentation', 120_000)
  await anEnvelope(monthOf(todayLocally()), 'Alimentation', 50_000)

  const { screen } = await renderApp('/budgets')

  await screen.getByRole('button', { name: 'Dupliquer le mois précédent' }).click()

  await expect.element(screen.getByText(new RegExp(`Reste ${xof('50 000')}`, 'u'))).toBeVisible()
  expect(await pb.collection('budgets').getFullList()).toHaveLength(2)
})

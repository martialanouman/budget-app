import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
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

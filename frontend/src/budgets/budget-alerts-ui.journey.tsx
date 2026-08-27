import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

async function anEnvelope(cap: number) {
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 500_000,
  })

  const categories = await pb.collection('categories').getFullList<Category>()

  await pb.collection('budgets').create({
    user: currentUserId(),
    month: monthOf(todayLocally()),
    category: categories.find((one) => one.name === 'Alimentation')!.id,
    cap_amount: cap,
    carry_over: false,
    carried_amount: 0,
  })
}

beforeEach(() => {
  pb.authStore.clear()
})

// BUD-04 end to end: the expense is typed on the screen the user actually
// uses, and the alert has to be waiting for them on the budget screen.
it('alerts on the budget screen after an expense busts the cap', async () => {
  await createSignedInUser('aui')
  await anEnvelope(100_000)

  const { screen } = await renderApp('/transactions')

  await screen.getByLabelText('Montant').fill('120 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await screen.getByRole('link', { name: 'Budgets' }).click()

  await expect.element(screen.getByText(/Alimentation .+ plafond dépassé/iu)).toBeVisible()
})

it('lets the user dismiss an alert they have seen', async () => {
  await createSignedInUser('aui')
  await anEnvelope(100_000)

  const { screen } = await renderApp('/transactions')

  await screen.getByLabelText('Montant').fill('85 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await screen.getByRole('link', { name: 'Budgets' }).click()

  await screen.getByRole('button', { name: /Marquer comme lue/u }).click()

  await expect.element(screen.getByText('Aucune alerte.')).toBeVisible()
})

import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

// Matched with \s: Intl separates thousands with narrow and non-breaking
// spaces, whose code points follow the ICU version bundled with the runtime.
const xof = (amount: string) => new RegExp(`^${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

beforeEach(() => {
  pb.authStore.clear()
})

it('creates two accounts and archives one of them', async () => {
  await createSignedInUser('owner')
  const { screen } = await renderApp('/accounts')

  await screen.getByLabelText('Nom').fill('Compte courant')
  await screen.getByLabelText('Solde initial').fill('150 000')
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByText(xof('150 000'))).toBeVisible()

  await screen.getByLabelText('Nom').fill('Espèces')
  await screen.getByLabelText('Type').selectOptions('especes')
  await screen.getByLabelText('Solde initial').fill('25 000')
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByText(xof('25 000'))).toBeVisible()

  await screen.getByRole('button', { name: 'Archiver Espèces' }).click()

  // Gone from the active list, but still restorable: the history is kept.
  await expect.element(screen.getByRole('heading', { name: 'Comptes archivés' })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Restaurer Espèces' })).toBeVisible()
  await expect.element(screen.getByText(xof('25 000'))).not.toBeInTheDocument()
})

it('displays the balance served by the view, formatted in francs', async () => {
  await createSignedInUser('owner')

  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Épargne',
    type: 'epargne',
    initial_balance: 90_000,
  })

  const { screen } = await renderApp('/accounts')

  await expect.element(screen.getByText(xof('90 000'))).toBeVisible()
})

it.each(['1500,75', '1500.75', '99999999999999999999'])(
  'refuses the initial balance "%s"',
  async (amount) => {
    await createSignedInUser('owner')
    const { screen } = await renderApp('/accounts')

    await screen.getByLabelText('Nom').fill('Compte bancaire')
    await screen.getByLabelText('Solde initial').fill(amount)
    await screen.getByRole('button', { name: 'Créer le compte' }).click()

    await expect.element(screen.getByText('Montant en francs, sans décimale')).toBeVisible()
    expect(await pb.collection('accounts').getFullList()).toEqual([])
  },
)

it('never exposes another owner’s accounts or balances', async () => {
  await createSignedInUser('owner')
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte privé',
    type: 'banque',
    initial_balance: 1_000,
  })

  await createSignedInUser('other')

  expect(await pb.collection('accounts').getFullList()).toEqual([])
  expect(await pb.collection('account_balances').getFullList()).toEqual([])
})

import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(`^-?${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

async function twoAccounts() {
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 150_000,
  })
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Épargne',
    type: 'epargne',
    initial_balance: 20_000,
  })
}

beforeEach(() => {
  pb.authStore.clear()
})

// CPT-05 end to end: one operation on screen, two balances moved, total intact.
it('transfers between accounts and leaves the total unchanged', async () => {
  await createSignedInUser('tfui')
  await twoAccounts()

  const { screen } = await renderApp('/transactions')

  await screen.getByLabelText('Montant à transférer').fill('30 000')
  await screen.getByLabelText('Depuis le compte').selectOptions('Compte courant')
  await screen.getByLabelText('Vers le compte').selectOptions('Épargne')
  await screen.getByRole('button', { name: 'Transférer' }).click()

  // Matched loosely: the row carries today's date, so pinning it would make
  // this test start failing tomorrow.
  await expect.element(screen.getByText(/^Virement sortant · .+ · Compte courant$/u)).toBeVisible()

  await screen.getByRole('link', { name: 'Comptes' }).click()

  await expect.element(screen.getByText(xof('120 000'))).toBeVisible()
  await expect.element(screen.getByText(xof('50 000'))).toBeVisible()
})

it('refuses a transfer to the same account', async () => {
  await createSignedInUser('tfui')
  await twoAccounts()

  const { screen } = await renderApp('/transactions')

  await screen.getByLabelText('Montant à transférer').fill('10 000')
  await screen.getByLabelText('Depuis le compte').selectOptions('Épargne')
  await screen.getByLabelText('Vers le compte').selectOptions('Épargne')
  await screen.getByRole('button', { name: 'Transférer' }).click()

  await expect.element(screen.getByText('Choisissez deux comptes différents')).toBeVisible()
  expect(await pb.collection('transactions').getFullList()).toEqual([])
})

it('hides the transfer form when there is only one account', async () => {
  await createSignedInUser('tfui')
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte unique',
    type: 'banque',
    initial_balance: 1_000,
  })

  const { screen } = await renderApp('/transactions')
  await expect.element(screen.getByLabelText('Compte', { exact: true })).toBeVisible()

  await expect
    .element(screen.getByRole('heading', { name: 'Virement entre comptes' }))
    .not.toBeInTheDocument()
})

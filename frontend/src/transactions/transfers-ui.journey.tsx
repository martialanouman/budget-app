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

  // The day now heads its own group, so the row itself carries only what
  // distinguishes it from the others — and this can be matched exactly.
  await expect.element(screen.getByText('Virement sortant · Compte courant')).toBeVisible()

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
  // Waited on an option that only exists once the accounts are in: asserting an
  // absence before the page has its data would pass whatever the rule is.
  await expect.element(screen.getByRole('option', { name: 'Compte unique' })).toBeInTheDocument()

  await expect
    .element(screen.getByRole('heading', { name: 'Virement entre comptes' }))
    .not.toBeInTheDocument()
})

// The two legs read identically to a screen reader: same wording, same date,
// nothing to tell the debit from the credit before pressing.
it('names each leg’s delete button after its own account', async () => {
  await createSignedInUser('tfui')
  await twoAccounts()

  const { screen } = await renderApp('/transactions')

  await screen.getByLabelText('Montant à transférer').fill('30 000')
  await screen.getByLabelText('Depuis le compte').selectOptions('Compte courant')
  await screen.getByLabelText('Vers le compte').selectOptions('Épargne')
  await screen.getByRole('button', { name: 'Transférer' }).click()

  await expect
    .element(
      screen.getByRole('button', { name: /^Supprimer Virement sortant sur Compte courant/u }),
    )
    .toBeVisible()
  await expect
    .element(screen.getByRole('button', { name: /^Supprimer Virement entrant sur Épargne/u }))
    .toBeVisible()
})

// The fallback label used to read the absence of a category as proof of a
// transfer, so an income typed without one was announced as "Virement".
it('does not call an uncategorised income a transfer', async () => {
  await createSignedInUser('tfui')
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 10_000,
  })

  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: '',
    type: 'revenu',
    amount: 5_000,
    date: '2026-08-19',
    note: '',
  })

  const { screen } = await renderApp('/transactions')

  await expect.element(screen.getByText('Sans catégorie')).toBeVisible()
  await expect.element(screen.getByText('Virement', { exact: true })).not.toBeInTheDocument()
})

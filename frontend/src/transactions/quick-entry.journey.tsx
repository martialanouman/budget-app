import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(`^-?${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

/** The spec's own number for TRX-01, generous on purpose: it can only fail on a
    regression that puts a round trip, or a screen, where there was none. */
const BUDGET_MS = 10_000

beforeEach(() => {
  pb.authStore.clear()
})

async function anAccount(initialBalance: number) {
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: initialBalance,
  })
}

/**
 * TRX-01, held by what it actually costs the user: four gestures from the
 * dashboard — open, amount, category, save — and no navigation at all.
 *
 * The gesture count is the discriminating half, and it is what the clock alone
 * would miss. Verified by sabotage: making the note required — one more field
 * standing between the user and their entry — turns two of these three red.
 * What it does not catch is a field made *visible* again with a default, which
 * costs scrolling rather than gestures.
 */
it('records an expense in four gestures without leaving the dashboard', async () => {
  await createSignedInUser('qe')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText(xof('150 000'))).toBeVisible()

  const started = performance.now()

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByLabelText('Montant', { exact: true }).fill('20 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText(xof('130 000'))).toBeVisible()

  expect(performance.now() - started).toBeLessThan(BUDGET_MS)
})

// The sheet closes itself on success. Left open, it would hide the very figure
// the user typed the expense to change.
it('closes the sheet once the entry is in', async () => {
  await createSignedInUser('qe')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByLabelText('Montant', { exact: true }).fill('20 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText(xof('130 000'))).toBeVisible()
  await expect.element(screen.getByLabelText('Montant', { exact: true })).not.toBeInTheDocument()
})

// A failed entry must not close over the amount the user typed: they would have
// to remember it and start again.
it('keeps the sheet open when the entry is refused', async () => {
  await createSignedInUser('qe')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByLabelText('Montant', { exact: true }).fill('0')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText('Montant en francs, supérieur à zéro')).toBeVisible()
  await expect.element(screen.getByLabelText('Montant', { exact: true })).toBeVisible()
})

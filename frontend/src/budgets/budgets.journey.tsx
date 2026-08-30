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
  await screen.getByRole('heading', { name: 'Définir une enveloppe' }).click()

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
  await screen.getByRole('heading', { name: 'Définir une enveloppe' }).click()

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
  await screen.getByRole('heading', { name: 'Définir une enveloppe' }).click()

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
  await screen.getByRole('heading', { name: 'Définir une enveloppe' }).click()

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

// BUD-05. The specs subtract fixed charges and realised spending both, which
// counts a paid fixed charge twice; only what is still unpaid on the fixed
// envelopes is deducted here.
it('shows what is left to live on', async () => {
  await createSignedInUser('bg')
  await anAccount()

  const account = await pb.collection('accounts').getFullList()

  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account[0]!.id,
    category: '',
    type: 'revenu',
    amount: 500_000,
    date: todayLocally(),
    note: 'Salaire',
  })

  await spend(120_000, 'Alimentation')
  await anEnvelope(monthOf(todayLocally()), 'Logement', 80_000)

  const { screen } = await renderApp('/budgets')

  await expect.element(screen.getByRole('heading', { name: 'Reste à vivre' })).toBeVisible()
  await expect
    .element(screen.getByText(new RegExp(`^${xof('300 000')}\\sF\\sCFA$`, 'u')))
    .toBeVisible()

  // Paying part of the fixed charge moves money from "still to pay" to
  // "already spent" — the figure must not move.
  await spend(30_000, 'Logement')

  await screen.getByRole('link', { name: 'Transactions' }).click()
  await screen.getByRole('link', { name: 'Budgets' }).click()

  await expect
    .element(screen.getByText(new RegExp(`^${xof('300 000')}\\sF\\sCFA$`, 'u')))
    .toBeVisible()
})

// BUD-06: an envelope marked for carry-over hands its leftover to the same
// category next month. Written as an absolute figure beside the cap, so the
// user keeps seeing the ceiling they chose.
it('carries an unspent envelope into the next month', async () => {
  await createSignedInUser('bg')
  await anAccount()

  const last = previousMonth(monthOf(todayLocally()))
  const categories = await pb.collection('categories').getFullList<Category>()
  const food = categories.find((one) => one.name === 'Alimentation')!.id

  await pb.collection('budgets').create({
    user: currentUserId(),
    month: last,
    category: food,
    cap_amount: 100_000,
    carry_over: true,
    carried_amount: 0,
  })
  await spend(70_000, 'Alimentation', `${last}-15`)

  const { screen } = await renderApp('/budgets')

  await screen.getByRole('button', { name: 'Dupliquer le mois précédent' }).click()

  // 100 000 of its own cap, plus the 30 000 left over last month.
  await expect.element(screen.getByText(new RegExp(`Reste ${xof('130 000')}`, 'u'))).toBeVisible()
})

// An overspent envelope carries nothing: a debt carried forward would shrink
// next month's cap without the user ever choosing it.
it('carries nothing from an envelope that was overspent', async () => {
  await createSignedInUser('bg')
  await anAccount()

  const last = previousMonth(monthOf(todayLocally()))
  const categories = await pb.collection('categories').getFullList<Category>()
  const food = categories.find((one) => one.name === 'Alimentation')!.id

  await pb.collection('budgets').create({
    user: currentUserId(),
    month: last,
    category: food,
    cap_amount: 100_000,
    carry_over: true,
    carried_amount: 0,
  })
  await spend(130_000, 'Alimentation', `${last}-15`)

  const { screen } = await renderApp('/budgets')

  await screen.getByRole('button', { name: 'Dupliquer le mois précédent' }).click()

  await expect.element(screen.getByText(new RegExp(`Reste ${xof('100 000')}`, 'u'))).toBeVisible()
})

// Without the tick, nothing moves: the report is an option (BUD-06).
it('carries nothing when the envelope was not marked for it', async () => {
  await createSignedInUser('bg')
  await anAccount()

  const last = previousMonth(monthOf(todayLocally()))

  await anEnvelope(last, 'Alimentation', 100_000)
  await spend(70_000, 'Alimentation', `${last}-15`)

  const { screen } = await renderApp('/budgets')

  await screen.getByRole('button', { name: 'Dupliquer le mois précédent' }).click()

  await expect.element(screen.getByText(new RegExp(`Reste ${xof('100 000')}`, 'u'))).toBeVisible()
})

// The monthly job, reached through a harness-only route. It re-computes the
// carry from scratch, which is what makes it safe to run twice — and what
// repairs an envelope created before the previous month was over.
it('recomputes a stale carry when the monthly job runs', async () => {
  await createSignedInUser('bg')
  await anAccount()

  const last = previousMonth(monthOf(todayLocally()))
  const categories = await pb.collection('categories').getFullList<Category>()
  const food = categories.find((one) => one.name === 'Alimentation')!.id

  await pb.collection('budgets').create({
    user: currentUserId(),
    month: last,
    category: food,
    cap_amount: 100_000,
    carry_over: true,
    carried_amount: 0,
  })

  // Created while last month still looked untouched: it takes the whole cap.
  await anEnvelope(monthOf(todayLocally()), 'Alimentation', 100_000)
  await spend(70_000, 'Alimentation', `${last}-15`)

  await pb.send('/api/test/apply-carry-over', {
    method: 'POST',
    body: { month: monthOf(todayLocally()) },
  })

  const { screen } = await renderApp('/budgets')

  await expect.element(screen.getByText(new RegExp(`Reste ${xof('130 000')}`, 'u'))).toBeVisible()
})

// An envelope set by mistake had no way out: the rule allowed the deletion,
// nothing on screen offered it.
it('removes an envelope set by mistake', async () => {
  await createSignedInUser('bg')
  await anAccount()
  await anEnvelope(monthOf(todayLocally()), 'Alimentation', 100_000)

  const { screen } = await renderApp('/budgets')

  await screen.getByRole('button', { name: 'Supprimer l’enveloppe Alimentation' }).click()

  await expect.element(screen.getByText('Aucune enveloppe pour ce mois.')).toBeVisible()
  expect(await pb.collection('budgets').getFullList()).toEqual([])
})

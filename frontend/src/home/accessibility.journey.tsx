import axe from 'axe-core'
import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

/**
 * WCAG AA, run rather than inspected.
 *
 * What this catches reliably: missing names, unlabelled controls, wrong roles,
 * broken heading and landmark structure. Verified by planting an image without
 * alt text, which it reported as critical.
 *
 * What it does not: colour contrast lands in axe's "incomplete" bucket
 * whenever it cannot resolve the background with certainty — a deliberately
 * unreadable paragraph went unreported. The palette is therefore checked by
 * hand, and the ratios that stand live in docs/specs-techniques-budget.md §2.1
 * rather than here: the figures this docstring used to carry outlived by two
 * days the stylesheet they described. Keyboard order and focus visibility
 * remain a human's job on a real device.
 */
async function violations() {
  const results = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })

  return results.violations.map(
    (violation) => `${violation.id} (${violation.impact}) — ${violation.nodes.length} élément(s)`,
  )
}

beforeEach(() => {
  pb.authStore.clear()
})

it('passes an automated WCAG AA pass on the dashboard', async () => {
  await createSignedInUser('a11y')

  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 400_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()
  const food = categories.find((one) => one.name === 'Alimentation')!.id

  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: food,
    type: 'depense',
    amount: 90_000,
    date: todayLocally(),
    note: '',
  })
  await pb.collection('budgets').create({
    user: currentUserId(),
    month: monthOf(todayLocally()),
    category: food,
    cap_amount: 100_000,
    carry_over: false,
    carried_amount: 0,
  })

  const { screen } = await renderApp('/')

  // Exact, because the name now appears twice: the envelope is set below what
  // has already been spent, so the dashboard carries the alert as well as the
  // breakdown row. The audit is the better for it — the amber card and its
  // dismiss button are on the page being checked.
  await expect.element(screen.getByText('Alimentation', { exact: true })).toBeVisible()

  expect(await violations()).toEqual([])
})

// The account screen grew from two sections to seven, three of them forms with
// password fields that look alike, and one a radio group. Labels that collide,
// or a toggle without a state, are exactly what an automated pass catches and a
// reading does not.
it('passes an automated WCAG AA pass on the account screen', async () => {
  await createSignedInUser('a11y')

  const { screen } = await renderApp('/profile')

  await expect.element(screen.getByLabelText('Mot de passe actuel')).toBeVisible()

  expect(await violations()).toEqual([])
})

// TRX-01's form is the screen used every day; it is the one that must not
// have a field a screen reader cannot name.
it('passes an automated WCAG AA pass on the entry form', async () => {
  await createSignedInUser('a11y')

  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 400_000,
  })

  const { screen } = await renderApp('/transactions')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await expect.element(screen.getByLabelText('Montant')).toBeVisible()

  expect(await violations()).toEqual([])
})

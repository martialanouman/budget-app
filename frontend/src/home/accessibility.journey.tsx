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
 * unreadable paragraph went unreported. The palette was therefore checked by
 * hand: slate-600 on slate-50 sits at 7.2:1, amber-700 at 4.6:1, red-700 at
 * 5.9:1, all above the 4.5:1 that AA asks of body text. Keyboard order and
 * focus visibility remain a human's job on a real device.
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

  await expect.element(screen.getByText('Alimentation')).toBeVisible()

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

  await expect.element(screen.getByLabelText('Montant')).toBeVisible()

  expect(await violations()).toEqual([])
})

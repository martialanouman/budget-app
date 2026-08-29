import { formatAmount, toMoney } from '@budget/domain'
import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const INITIAL_BALANCE = 500_000

beforeEach(() => {
  pb.authStore.clear()
})

// The DoD of this step, measured rather than estimated: three years of
// entries, roughly five thousand, and the dashboard has to answer.
//
// The figures are aggregated by SQLite in the views, so what travels is a
// handful of rows however long the history is. This test is what holds that:
// the day someone computes a total in the client, it goes red.
it('answers within two seconds on three years of entries', async () => {
  await createSignedInUser('load')
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: INITIAL_BALANCE,
  })

  const { net } = await pb.send<{ net: number }>('/api/test/seed-transactions', {
    method: 'POST',
    body: { account: account.id, count: 5_000 },
  })

  const expected = formatAmount(toMoney(INITIAL_BALANCE + net))

  const startedAt = performance.now()

  const { screen } = await renderApp('/')

  // Waiting on a figure, not on a heading: the headings are static text and
  // are on screen before a single query has answered. A first attempt asserted
  // those and measured 23 ms of nothing.
  //
  // The figure is the one the seed reports back, so nothing here rests on
  // which category reached the top five.
  await expect
    .element(screen.getByText(new RegExp(`^${expected.replace(/\s/gu, '\\s')}$`, 'u')))
    .toBeVisible()
  await expect.element(screen.getByText('Aucune dépense ce mois-ci.')).not.toBeInTheDocument()

  const elapsed = performance.now() - startedAt

  // Measured at 74 ms locally on 5 000 entries. The bound is the one the plan
  // sets, and the margin is what says the aggregation stayed in SQLite.
  expect(elapsed).toBeLessThan(2_000)
})

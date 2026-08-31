import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * The history screen on three years of entries. Until this change the list was
 * read whole, which cost one SQLite sort however long it was; paging costs one
 * per page, and the two indexes that existed carried `account` and `category`
 * in second position, so neither could order by date on the screen's own
 * default — no filter at all.
 *
 * Migration 1787600000 adds the index that serves that order — and this test
 * does NOT discriminate it. Measured both ways: 77 ms with the index and 77 ms
 * without, because at 5 000 entries the sort is a few milliseconds and the
 * render is everything else. The index earns itself at the query instead —
 * 3 ms then 2 ms for pages 1 and 100, against 6 ms then 9 ms without — and
 * that is written in the migration, where it belongs.
 *
 * What this test holds is the budget the plan sets for the screen, and the one
 * regression that would blow it: a list that stops paging and reads the whole
 * history again.
 */
it('opens the history within two seconds on three years of entries', async () => {
  await createSignedInUser('listload')
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 500_000,
  })

  await pb.send('/api/test/seed-transactions', {
    method: 'POST',
    body: { account: account.id, count: 5_000 },
  })

  const startedAt = performance.now()

  const { screen } = await renderApp('/transactions')

  // Waiting on a row, never on the heading: the headings and the filter labels
  // are on screen before a single query has answered, and asserting those
  // would time nothing at all.
  await expect.element(screen.getByRole('button', { name: 'Charger plus' })).toBeVisible()

  const elapsed = performance.now() - startedAt

  expect(elapsed).toBeLessThan(2_000)
})

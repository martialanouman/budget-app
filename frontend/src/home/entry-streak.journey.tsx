import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

beforeEach(() => {
  pb.authStore.clear()
})

/** A local calendar day, counted back from today the way the user's clock does. */
function daysAgo(count: number) {
  const day = new Date(`${todayLocally()}T12:00:00`)

  day.setDate(day.getDate() - count)

  return day.toISOString().slice(0, 10)
}

async function anAccountAndCategory() {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 600_000,
  })
  const categories = await pb.collection('categories').getFullList<Category>()

  return {
    account: account.id,
    category: categories.find((one) => one.name === 'Alimentation')!.id,
  }
}

const spendOn = (account: string, category: string, date: string) =>
  pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category,
    type: 'depense',
    amount: 1_000,
    date,
    note: '',
  })

/**
 * RAP-06. The only figure on this screen that speaks of the habit rather than
 * the money: keeping accounts is something you do, before it is something you
 * calculate.
 *
 * Counted in SQLite rather than in the browser. The dashboard loads no
 * transactions at all — counting here would mean fetching every date in the
 * history on every open, which is exactly what dashboard-load.journey.tsx
 * exists to forbid.
 */
it('counts the consecutive days that end today', async () => {
  await createSignedInUser('streak')
  const { account, category } = await anAccountAndCategory()

  for (const date of [daysAgo(2), daysAgo(1), daysAgo(0)]) {
    await spendOn(account, category, date)
  }

  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('region', { name: 'Série de saisie' })).toBeVisible()
  await expect.element(screen.getByText('3 jours d’affilée')).toBeVisible()
})

/**
 * A gap breaks it, and only the run that reaches the present day counts. Three
 * days last week and one today is a streak of one, not of four.
 */
it('counts only the run that reaches today, not the longest one', async () => {
  await createSignedInUser('streak')
  const { account, category } = await anAccountAndCategory()

  for (const date of [daysAgo(9), daysAgo(8), daysAgo(7), daysAgo(6), daysAgo(0)]) {
    await spendOn(account, category, date)
  }

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText('1 jour d’affilée')).toBeVisible()
})

/**
 * Yesterday's run is still alive: at eight in the morning nobody has typed
 * anything yet, and showing a zero would punish opening the app early. What the
 * screen owes instead is the nudge — the streak is standing, and today is what
 * keeps it.
 */
it('keeps yesterday’s run standing, and says what holds it', async () => {
  await createSignedInUser('streak')
  const { account, category } = await anAccountAndCategory()

  for (const date of [daysAgo(2), daysAgo(1)]) {
    await spendOn(account, category, date)
  }

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText('2 jours d’affilée')).toBeVisible()
  await expect.element(screen.getByText(/Saisissez aujourd’hui pour la garder/u)).toBeVisible()
})

/** Older than yesterday, and there is nothing to keep. */
it('says there is no run when the last entry is older than yesterday', async () => {
  await createSignedInUser('streak')
  const { account, category } = await anAccountAndCategory()

  await spendOn(account, category, daysAgo(4))

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText('Aucune série en cours')).toBeVisible()
})

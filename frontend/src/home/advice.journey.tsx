import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

beforeEach(() => {
  pb.authStore.clear()
})

async function anAccountAndCategory() {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 0,
  })
  const categories = await pb.collection('categories').getFullList<Category>()

  return {
    account: account.id,
    category: categories.find((one) => one.name === 'Alimentation')!.id,
  }
}

const entry = (account: string, category: string, type: string, amount: number) =>
  pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category,
    type,
    amount,
    date: todayLocally(),
    note: '',
  })

/**
 * RAP-07. The rules are explicit and the sentences are written: nothing here is
 * generated at runtime, one wording is chosen among a handful.
 *
 * What the counsel actually adds is the per-day framing. A month's remainder is
 * not a figure anyone can act on; what is left per day until the month ends is.
 */
it('turns what is left into what is left per day', async () => {
  await createSignedInUser('advice')
  const { account, category } = await anAccountAndCategory()

  await entry(account, category, 'revenu', 300_000)
  await entry(account, category, 'depense', 50_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('note', { name: 'Conseil' })).toHaveTextContent(/par jour/u)
})

/**
 * Past the month's income, the per-day framing would be a nonsense — there is
 * no daily allowance to divide. The counsel changes to what can still be done.
 */
it('says the month is overrun rather than dividing a negative', async () => {
  await createSignedInUser('advice')
  const { account, category } = await anAccountAndCategory()

  await entry(account, category, 'revenu', 100_000)
  await entry(account, category, 'depense', 250_000)

  const { screen } = await renderApp('/')

  const advice = screen.getByRole('note', { name: 'Conseil' })

  await expect.element(advice).toHaveTextContent(/plus que vos revenus du mois/u)
  await expect.element(advice).not.toHaveTextContent(/par jour/u)
})

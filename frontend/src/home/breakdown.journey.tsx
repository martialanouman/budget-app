import { beforeEach, expect, it } from 'vitest'
// The stylesheet, for the reason the appearance journey needs it: a hue is a
// CSS token, and a token the build never resolved paints nothing at all.
import '@/styles.css'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

beforeEach(() => {
  pb.authStore.clear()
})

async function anAccount() {
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 1_000_000,
  })

  return account.id
}

const idOf = async (name: string) => {
  const categories = await pb.collection('categories').getFullList<Category>()

  return categories.find((one) => one.name === name)!.id
}

const spend = (account: string, category: string, amount: number) =>
  pb.collection('transactions').create({
    user: currentUserId(),
    account,
    category,
    type: 'depense',
    amount,
    date: todayLocally(),
    note: '',
  })

/**
 * RAP-02: the legend carries the reading, and it is ordered. Comparing angles
 * is the hardest comparison there is, so the ring never has to be compared —
 * the figures are written out, largest first.
 */
it('ranks the month’s spending with its figures and its shares', async () => {
  await createSignedInUser('bd')
  const account = await anAccount()

  await spend(account, await idOf('Alimentation'), 120_000)
  await spend(account, await idOf('Transport'), 60_000)
  await spend(account, await idOf('Logement'), 20_000)

  const { screen } = await renderApp('/')

  const legend = screen.getByRole('list', { name: 'Répartition des dépenses' })

  await expect.element(legend.getByRole('listitem').first()).toHaveTextContent(/Alimentation/u)
  // 120 000 of 200 000 spent.
  await expect.element(legend.getByRole('listitem').first()).toHaveTextContent(/60\s*%/u)
  await expect.element(legend.getByRole('listitem').nth(1)).toHaveTextContent(/Transport/u)
})

/**
 * The ring is decoration and says so. Every figure it draws is in the legend
 * beside it, so hiding it costs a reader nothing — and leaving it exposed would
 * offer a screen reader a shape with no reading.
 */
it('hides the ring from assistive technology', async () => {
  await createSignedInUser('bd')
  const account = await anAccount()

  await spend(account, await idOf('Alimentation'), 120_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('list', { name: 'Répartition des dépenses' })).toBeVisible()

  // Reached through one of its own arcs, never through `querySelector('svg')`:
  // the first svg in the document is a lucide icon in the navigation, which
  // lucide already marks aria-hidden. Asserted that way the test passed with
  // the ring fully exposed — measured by removing the attribute.
  const ring = document.querySelector('[data-hue]')?.closest('svg')

  expect(ring).not.toBe(null)
  expect(ring?.getAttribute('aria-hidden')).toBe('true')
})

/**
 * The hue a category was given is the hue its arc is drawn in — that is what
 * ties the ring to the legend, and it is the only thing the ring contributes.
 *
 * Asserted on the painted colour rather than on the class name: a token the
 * build never generated leaves a transparent arc, and a class assertion cannot
 * tell the two apart (measured on the appearance journey).
 */
it('draws each arc in the hue its category was given', async () => {
  await createSignedInUser('bd')
  const account = await anAccount()
  const food = await idOf('Alimentation')

  await pb.collection('categories').update(food, { color: 'indigo' })
  await spend(account, food, 120_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('list', { name: 'Répartition des dépenses' })).toBeVisible()

  const hex = getComputedStyle(document.documentElement).getPropertyValue('--k-hue-indigo').trim()
  const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  const arc = document.querySelector('svg [data-hue]')

  expect(hex).not.toBe('')
  expect(getComputedStyle(arc!).stroke).toBe(`rgb(${red}, ${green}, ${blue})`)
})

/**
 * Beyond the top five the ring would claim to show where the money went while
 * omitting part of it. The remainder is a slice of its own, so the shares add
 * up to the month.
 */
it('gathers everything past the top five into one slice', async () => {
  await createSignedInUser('bd')
  const account = await anAccount()

  for (const [name, amount] of [
    ['Alimentation', 60_000],
    ['Transport', 50_000],
    ['Logement', 40_000],
    ['Santé', 30_000],
    ['Loisirs', 20_000],
    ['Éducation', 10_000],
  ] as const) {
    await spend(account, await idOf(name), amount)
  }

  const { screen } = await renderApp('/')

  const legend = screen.getByRole('list', { name: 'Répartition des dépenses' })

  await expect.element(legend.getByRole('listitem').nth(5)).toHaveTextContent(/Autres/u)
})

/**
 * The names come before the drawing. Without them every row falls back to
 * "Sans catégorie" and every arc to the one hue that string derives, so five
 * categories are rendered as one grey row repeated and the ring as a single
 * solid colour — a picture that is not merely incomplete but wrong.
 *
 * "Aucun chiffre n'est affiché avant d'avoir été lu" is the policy the three
 * figures above already hold; a label is no different, and the ring made the
 * breach loud rather than quiet.
 *
 * The probe withholds the list rather than slowing it: a race between two real
 * queries lasts a few milliseconds, and no assertion can be both stable and
 * discriminating against it.
 */
it('draws nothing until the category names are in', async () => {
  await createSignedInUser('blindcat')
  const account = await anAccount()
  const seeded = await pb
    .collection('categories')
    .getFullList<Category>({ headers: { 'X-Probe-Seed': '1' } })

  await spend(account, seeded.find((one) => one.name === 'Alimentation')!.id, 120_000)
  await spend(account, seeded.find((one) => one.name === 'Transport')!.id, 60_000)

  const { screen } = await renderApp('/')

  // Waited on a figure, never on a heading: the headings are static text and
  // are on screen before a single query has answered, so asserting an absence
  // after one of them asserts nothing at all. 1 000 000 opened, 180 000 spent.
  await expect
    .element(screen.getByRole('region', { name: 'Solde total' }).getByText(/820\s?000/u))
    .toBeVisible()

  expect(screen.getByRole('list', { name: 'Répartition des dépenses' }).elements()).toHaveLength(0)
  expect(screen.getByText('Sans catégorie').elements()).toHaveLength(0)
  expect(screen.getByText('Aucune dépense ce mois-ci.').elements()).toHaveLength(0)
})

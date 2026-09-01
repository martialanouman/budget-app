import { beforeEach, expect, it } from 'vitest'
// The one journey file that needs the stylesheet, and it needs it for the
// reason the whole palette exists: a hue is a class, so a hue that Tailwind
// never generated is a transparent square and nothing else. `main.tsx` is what
// imports this in the application, and the journeys mount the router directly.
import '@/styles.css'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Account, type Category } from '@/lib/collections'
import { ACCOUNT_TYPE_ICONS, FALLBACK_ICON, type Hue, HUES, hueFor } from '@/lib/appearance'
import { pb } from '@/lib/pocketbase'

const listCategories = () => pb.collection('categories').getFullList<Category>()

const found = async (name: string) =>
  (await listCategories()).find((category) => category.name === name)!

/**
 * The ornament a list row carries to the left of its name. It is aria-hidden —
 * it decorates, and the name is always beside it — so it is reached through the
 * row that owns it rather than through the accessibility tree.
 */
const decorationIn = (name: string) => {
  const row = [...document.querySelectorAll('li')].find((item) => item.textContent?.includes(name))
  const decoration = row?.querySelector<HTMLElement>('[aria-hidden="true"]')

  if (!decoration) throw new Error(`No row carrying "${name}" is on screen`)

  return decoration
}

/**
 * What the stylesheet resolves a hue to. Going through the custom property is
 * what lets the assertions below name a hue rather than a colour triplet, and
 * what makes them fail if the class resolves to nothing — which is exactly how
 * a missing derivation shows up: a transparent square, not a wrong one.
 */
const paintOf = (hue: Hue) => {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(`--k-hue-${hue}`).trim()
  const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))

  return `rgb(${red}, ${green}, ${blue})`
}

const paintIn = (name: string) => getComputedStyle(decorationIn(name)).backgroundColor

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * CAT-04, at the one moment nobody chooses anything: sign-up. Eleven default
 * categories arrive from a hook, and a colourless one among ten coloured reads
 * as a defect rather than as a default.
 *
 * Discriminating: drop `icon` from the seed hook and this reddens.
 */
it('gives every seeded category an icon and a colour of its own', async () => {
  await createSignedInUser('appear')

  const categories = await listCategories()

  expect(categories.length).toBe(11)
  expect(categories.every((category) => category.icon !== '')).toBe(true)
  expect(categories.every((category) => HUES.includes(category.color as never))).toBe(true)

  // Not the same one eleven times, which a broken loop would also satisfy.
  expect(new Set(categories.map((category) => category.icon)).size).toBe(11)
  expect((await found('Alimentation')).icon).toBe('🍚')
})

// The picker has to reach the database, not merely the form: the fields are new
// and nothing else in the application had ever written to them.
it('keeps the icon and the colour chosen for a new category', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/categories')

  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()
  await screen.getByLabelText('Nom').fill('Coiffeur')
  await screen.getByLabelText('👕').click()
  await screen.getByLabelText('Indigo').click()
  await screen.getByRole('button', { name: 'Créer la catégorie' }).click()

  await expect.element(screen.getByRole('button', { name: 'Désactiver Coiffeur' })).toBeVisible()

  const created = await found('Coiffeur')
  expect(created.icon).toBe('👕')
  expect(created.color).toBe('indigo')

  expect(paintIn('Coiffeur')).toBe(paintOf('indigo'))
  expect(decorationIn('Coiffeur').textContent).toBe('👕')
})

/**
 * The rows that existed before the migration, which nothing back-filled. The
 * assertion is on what the row draws, not on what `hueFor` returns: the earlier
 * version of this test compared the function to itself, so gutting both
 * fallbacks left the whole suite green.
 *
 * Discriminating: make `hueClassOf` or `iconOf` return '' for a stored blank
 * and this reddens.
 */
it('draws a derived icon and colour for a category that has neither', async () => {
  await createSignedInUser('appear')

  await pb.collection('categories').create({
    user: currentUserId(),
    name: 'Sans apparence',
    kind: 'variable',
    active: true,
    icon: '',
    color: '',
  })

  const { screen } = await renderApp('/categories')

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver Sans apparence' }))
    .toBeVisible()

  expect(decorationIn('Sans apparence').textContent).toBe(FALLBACK_ICON)
  expect(paintIn('Sans apparence')).toBe(paintOf(hueFor('Sans apparence')))
})

/**
 * CAT-04 says the colour is the user's choice and, failing that, derived from
 * the name. A form that pre-selects one hue satisfies neither half: nothing was
 * chosen, and nothing was derived — every category made in a row came out the
 * same colour, which is the one thing a colour must not do.
 *
 * The neutral icon is the deliberate exception, and it is why the two fields
 * are asserted differently here: no derivation knows that a category called
 * "Coiffeur" wants a particular emoji, and a hash into the grid would hand it a
 * taxi.
 */
it('leaves an unchosen appearance empty and derives what each row shows', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/categories')

  await screen.getByRole('heading', { name: 'Ajouter une catégorie' }).click()

  for (const name of ['Coiffeur', 'Plomberie']) {
    await screen.getByLabelText('Nom').fill(name)
    await screen.getByRole('button', { name: 'Créer la catégorie' }).click()
    await expect.element(screen.getByRole('button', { name: `Désactiver ${name}` })).toBeVisible()
  }

  // Not chosen is stored as not chosen, so the fallback lives in one place
  // rather than being frozen into the row at the moment it was created.
  expect((await found('Coiffeur')).color).toBe('')
  expect((await found('Coiffeur')).icon).toBe('')

  // Two hues, not one twice. hueFor('Coiffeur') is vert and hueFor('Plomberie')
  // is framboise, so a form default would be caught by either line.
  expect(paintIn('Coiffeur')).toBe(paintOf(hueFor('Coiffeur')))
  expect(paintIn('Plomberie')).toBe(paintOf(hueFor('Plomberie')))
  expect(paintIn('Coiffeur')).not.toBe(paintIn('Plomberie'))

  expect(decorationIn('Coiffeur').textContent).toBe(FALLBACK_ICON)
})

// CPT-02 has asked for an account colour since the first specification, and
// `accounts.color` has been in the collection since step 3 with nothing ever
// writing to it. Discriminating: remove `color` from the account draft.
it('keeps the colour chosen for a new account', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/accounts')

  await screen.getByRole('heading', { name: 'Ajouter un compte' }).click()
  await screen.getByLabelText('Nom').fill('Wave')
  await screen.getByLabelText('Solde initial').fill('38200')
  await screen.getByLabelText('Sarcelle').click()
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByRole('button', { name: 'Archiver Wave' })).toBeVisible()

  const accounts = await pb.collection('accounts').getFullList<Account>()
  expect(accounts.find((account) => account.name === 'Wave')?.color).toBe('sarcelle')
  expect(paintIn('Wave')).toBe(paintOf('sarcelle'))
})

// The other half of CPT-02, and the half a pre-selected default hid: an account
// whose owner chose no colour still has one, and it comes from its name.
it('derives an account colour from its name when none is chosen', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/accounts')

  await screen.getByRole('heading', { name: 'Ajouter un compte' }).click()
  await screen.getByLabelText('Nom').fill('Tontine')
  await screen.getByLabelText('Solde initial').fill('12000')
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByRole('button', { name: 'Archiver Tontine' })).toBeVisible()

  const accounts = await pb.collection('accounts').getFullList<Account>()
  expect(accounts.find((account) => account.name === 'Tontine')?.color).toBe('')
  expect(paintIn('Tontine')).toBe(paintOf(hueFor('Tontine')))
})

/**
 * CPT-02, to the letter: "L'icône du compte est déduite de son type et ne se
 * choisit pas". Both halves are asserted, because the second is the one a
 * picker would quietly break — an account icon offered as a choice would look
 * like a feature rather than like the requirement it contradicts.
 */
it('marks an account with the icon of its type, which is never chosen', async () => {
  await createSignedInUser('appear')
  const { screen } = await renderApp('/accounts')

  await screen.getByRole('heading', { name: 'Ajouter un compte' }).click()
  await screen.getByLabelText('Nom').fill('Orange Money')
  await screen.getByLabelText('Type').selectOptions('Mobile money')
  await screen.getByLabelText('Solde initial').fill('7500')

  expect(screen.getByRole('group', { name: 'Icône' }).elements()).toHaveLength(0)

  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByRole('button', { name: 'Archiver Orange Money' })).toBeVisible()

  expect(decorationIn('Orange Money').textContent).toBe(ACCOUNT_TYPE_ICONS.mobile_money)
})

/**
 * USR-04. The export sends these collections through `publicExport()`, so new
 * columns travel on their own — unlike the account block, which is an explicit
 * allow-list. This test is what says so, rather than the reading that says so.
 */
it('carries the new fields into the data export', async () => {
  await createSignedInUser('appear')

  const response: { categories: Category[] } = await pb.send('/api/export', { method: 'GET' })
  const alimentation = response.categories.find((category) => category.name === 'Alimentation')

  expect(alimentation?.icon).toBe('🍚')
  expect(alimentation?.color).toBe('terracotta')
})

import { beforeEach, expect, it } from 'vitest'
import { page } from 'vitest/browser'
// The stylesheet, for the same reason the appearance journey needs it: the
// rail and the tab bar are chosen by width, and a width the build never
// generated is a layout nobody sees. Assertions here go to what is on screen.
import '@/styles.css'
import { createSignedInUser, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * §8 of the functional specs says the refonte gives Épargne and Rapports a
 * navigation entry and a waiting screen. Neither existed: the two words were
 * nowhere in the router, so anyone typing the address met "Page introuvable"
 * and anyone looking at the tab bar concluded the application does not do
 * savings at all.
 *
 * A waiting screen says which requirement is coming and what answers part of
 * the need today. "Bientôt" alone is a shrug.
 */
it('gives savings a screen that says what is coming', async () => {
  await createSignedInUser('shell')

  const { screen } = await renderApp('/savings')

  await expect.element(screen.getByRole('heading', { name: 'Épargne', level: 1 })).toBeVisible()
  // Not "Bientôt" alone: the screen points at what already holds the money.
  await expect.element(screen.getByRole('link', { name: 'Voir mes Comptes' })).toBeVisible()
})

it('gives reports a screen that says what is coming', async () => {
  await createSignedInUser('shell')

  const { screen } = await renderApp('/reports')

  await expect.element(screen.getByRole('heading', { name: 'Rapports', level: 1 })).toBeVisible()
})

/**
 * Nine destinations, and a tab bar that holds five because five is where a
 * thumb stops distinguishing. The other four are behind one button, and the
 * question a menu has to answer is not "does it open" but "does it arrive".
 */
it('reaches the destinations that are not in the tab bar', async () => {
  await createSignedInUser('shell')
  const { screen } = await renderApp('/')

  for (const label of ['Catégories', 'Épargne', 'Rapports', 'Mon compte'] as const) {
    await screen.getByRole('button', { name: 'Menu' }).click()
    await screen.getByRole('link', { name: label, exact: true }).click()

    await expect.element(screen.getByRole('heading', { name: label, level: 1 })).toBeVisible()
  }
})

/**
 * A modal that survives the navigation it just performed covers the screen it
 * was asked to reveal — and on a `<dialog>` it also holds the focus trap, so
 * the page underneath cannot be reached at all.
 */
it('closes the menu once it has taken you somewhere', async () => {
  await createSignedInUser('shell')
  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Menu' }).click()
  await screen.getByRole('link', { name: 'Catégories', exact: true }).click()

  await expect.element(screen.getByRole('heading', { name: 'Catégories', level: 1 })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Mon compte', exact: true }).elements()).toHaveLength(0)
})

/**
 * Signing out moved off the header and into the menu, and it is the one control
 * there whose loss is silent: the others announce themselves by not navigating,
 * this one would leave a session open on a shared phone.
 */
it('signs out from the menu', async () => {
  await createSignedInUser('shell')
  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Menu' }).click()
  await screen.getByRole('button', { name: 'Se déconnecter' }).click()

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  expect(pb.authStore.isValid).toBe(false)
})

/**
 * The greeting left the header, where it was truncated to
 * "Bon retour, capture17882…@…" on a 390px screen. It has room in the menu, and
 * the menu is where the sign-out button is — which is the whole reason the
 * address has to be beside it. On a shared phone, or between two people who go
 * by the same first name, nothing else says whose data is about to disappear.
 */
it('names the account in the menu, beside the button that leaves it', async () => {
  const email = await createSignedInUser('shell')
  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Menu' }).click()

  await expect.element(screen.getByText(email)).toBeVisible()
})

/**
 * From 768px the rail replaces the bar and the menu both. The property worth
 * holding is not that a rail appears but that the other two are *gone*: a bar
 * fixed to the bottom of a desktop window is a phone stretched wide, and a menu
 * button beside a navigation that already shows everything is a button that
 * opens what is already open.
 *
 * The navigation is chosen in JavaScript rather than by `md:hidden`, so the
 * assertion can be on the document itself — there is one nav, not two with one
 * hidden.
 */
it('replaces the bar and the menu with a rail on a wide screen', async () => {
  await page.viewport(1280, 900)
  await createSignedInUser('shell')

  try {
    const { screen } = await renderApp('/')

    // All nine, without opening anything.
    for (const label of ['Accueil', 'Comptes', 'Catégories', 'Rapports'] as const) {
      await expect.element(screen.getByRole('link', { name: label, exact: true })).toBeVisible()
    }

    expect(screen.getByRole('button', { name: 'Menu' }).elements()).toHaveLength(0)
    expect(document.querySelectorAll('[aria-label="Navigation principale"]')).toHaveLength(1)
  } finally {
    await page.viewport(414, 896)
  }
})

/**
 * And the reverse, which is the half a media query gets wrong silently: the
 * rail must not be in the document on a phone, where it would be a second
 * "Comptes" link over the tab bar's own.
 */
it('keeps the rail out of the document on a phone', async () => {
  await createSignedInUser('shell')
  const { screen } = await renderApp('/')

  await expect.element(screen.getByRole('button', { name: 'Menu' })).toBeVisible()

  expect(screen.getByRole('link', { name: 'Comptes', exact: true }).elements()).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Rapports', exact: true }).elements()).toHaveLength(0)
})

import { afterEach, beforeEach, expect, it } from 'vitest'
// Imported for the same reason `appearance.journey.tsx` imports it, and it is
// the same reason twice: what this control changes is which palette paints the
// page, and a palette is a stylesheet. Journeys mount the router directly and
// never `main.tsx`, so without this they run with no styles at all — and the
// assertion below would read the same colour whatever the control did.
import '@/styles.css'
import { createSignedInUser, renderApp } from '../../test/journey-harness.tsx'
import { installTheme } from '@/lib/theme.ts'
import { pb } from '@/lib/pocketbase'

const STORAGE_KEY = 'kalpe:theme'

/**
 * The two `--k-bg` values from styles.css, written out rather than read back.
 * Reading the token from the same root the choice has just changed would
 * compare the palette to itself: a control that did nothing would leave both
 * sides light and the assertion green.
 */
const PAGE = { light: 'rgb(250, 247, 242)', dark: 'rgb(22, 19, 15)' }

const pageColour = () => getComputedStyle(document.body).backgroundColor

const forgetTheme = () => {
  localStorage.removeItem(STORAGE_KEY)
  document.documentElement.removeAttribute('data-theme')
}

beforeEach(() => {
  pb.authStore.clear()
  forgetTheme()
})

afterEach(forgetTheme)

/**
 * USR-10, whose second half had no way in. `lib/theme.ts` was built, wired into
 * `main.tsx` and covered by its own journey at the first refonte PR — and
 * nothing anywhere called `setThemePreference`, so the explicit choice the
 * requirement promises was unreachable and the whole `[data-theme]` half of the
 * palette was dead code in the product.
 *
 * Asserted in both directions on purpose: the machine running this decides what
 * "system" resolves to, so a one-way assertion would pass for the wrong reason
 * on a laptop set to dark.
 */
it('paints the page with the palette the owner picks, both ways', async () => {
  await createSignedInUser('theme')
  const { screen } = await renderApp('/profile')

  await screen.getByRole('radio', { name: 'Sombre' }).click()
  await expect.poll(pageColour).toBe(PAGE.dark)

  await screen.getByRole('radio', { name: 'Clair' }).click()
  await expect.poll(pageColour).toBe(PAGE.light)
})

/**
 * Two tabs are two module instances, and the choice travels between them
 * through a `storage` event — which is why `useThemePreference` is a
 * `useSyncExternalStore` and not a `useState` seeded once.
 *
 * `theme.journey.ts` holds that the attribute follows; this holds that the
 * control does. A group that read the preference only at mount would paint the
 * page correctly and go on showing "Système" as the answer.
 */
it('follows a palette chosen in another tab', async () => {
  // What `main.tsx` calls at start-up, and the journeys mount the router
  // instead. It is also where the cross-tab listener lives rather than in
  // `subscribe`: a tab showing the dashboard has nothing subscribed, and that
  // is exactly the tab the change has to reach.
  installTheme()

  await createSignedInUser('theme')
  const { screen } = await renderApp('/profile')

  await expect.element(screen.getByRole('radio', { name: 'Système' })).toBeChecked()

  localStorage.setItem(STORAGE_KEY, 'dark')
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'dark' }))

  await expect.element(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked()
})

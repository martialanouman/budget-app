import { afterEach, beforeEach, expect, it } from 'vitest'
// Imported for the same reason `appearance.journey.tsx` imports it, and it is
// the same reason twice: what this control changes is which palette paints the
// page, and a palette is a stylesheet. Journeys mount the router directly and
// never `main.tsx`, so without this they run with no styles at all — and the
// assertion below would read the same colour whatever the control did.
import '@/styles.css'
import { createSignedInUser, renderApp } from '../../test/journey-harness.tsx'
import { installTheme, setThemePreference } from '@/lib/theme.ts'
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

/**
 * Back through the module rather than by emptying `localStorage` behind it.
 * The applied preference is held in the module — that is what lets the control
 * keep telling the truth when storage refuses — so clearing the key directly
 * would leave the next test with the previous one's choice still applied. The
 * product has no such path: a whole-storage clear reaches it as a `storage`
 * event, which it follows.
 */
const forgetTheme = () => {
  setThemePreference('system')
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

/**
 * A browser can refuse to remember, and two ordinary configurations do: Safari
 * in private browsing and any browser set to block site data both raise on
 * access, which `lib/theme.ts` already says in the comment above its reader.
 *
 * The choice still applies for the session — nothing about painting the page
 * needs storage. What broke was the control: its snapshot asked storage what
 * was *stored* rather than what was *applied*, so the page turned dark under a
 * group still claiming « Système ». A control that misreports its own state is
 * worse than one that cannot be used.
 */
it('keeps saying which palette is on when the browser refuses to remember it', async () => {
  await createSignedInUser('theme')
  const { screen } = await renderApp('/profile')

  await expect.element(screen.getByRole('radio', { name: 'Système' })).toBeChecked()

  // Saved and put back as property descriptors rather than as three detached
  // methods: pulling `Storage.prototype.getItem` out by name is the very thing
  // that loses its `this`, and the whole browser runs on this object while the
  // refusal is in place.
  const original = Object.getOwnPropertyDescriptors(Storage.prototype)
  const refuse = {
    value: () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    },
    writable: true,
    configurable: true,
  }

  try {
    Object.defineProperties(Storage.prototype, {
      getItem: refuse,
      setItem: refuse,
      removeItem: refuse,
    })

    await screen.getByRole('radio', { name: 'Sombre' }).click()

    // Both halves, because they are what came apart: the page did turn dark
    // while the group went on claiming « Système ».
    await expect.poll(pageColour).toBe(PAGE.dark)
    await expect.element(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked()
  } finally {
    Object.defineProperties(Storage.prototype, {
      getItem: original.getItem,
      setItem: original.setItem,
      removeItem: original.removeItem,
    })
  }
})

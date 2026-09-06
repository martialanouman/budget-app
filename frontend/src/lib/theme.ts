import { useSyncExternalStore } from 'react'

/**
 * USR-10. Three states, not two: "system" is a real choice and the default one,
 * because someone who has set their phone to dark at night has already told us
 * what they want. "light" and "dark" are the overrides.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

const STORAGE_KEY = 'kalpe:theme'

/**
 * The app bar's colour in each theme — `--k-surface` from styles.css, repeated
 * because this runs before any stylesheet can be read and has to write a
 * literal into a meta tag. A palette change carries here too.
 */
const CHROME: Record<'light' | 'dark', string> = {
  light: '#ffffff',
  dark: '#201c17',
}

const OVERRIDE_META_ID = 'theme-color-override'

const isPreference = (value: string | null): value is ThemePreference =>
  value !== null && (THEME_PREFERENCES as readonly string[]).includes(value)

/**
 * Reading storage can throw outright, not merely come back empty: Safari in
 * private browsing and a browser set to block site data both raise on access.
 * A theme is a convenience, so failing to read one falls back to the system.
 */
export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    return isPreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/**
 * What is applied right now, which is not always what is stored.
 *
 * Reading storage can raise outright, and the control that reads it then
 * answers "system" while the page it sits on is painted dark — a control
 * misreporting its own state, which is worse than one that cannot be used at
 * all. Measured with storage refused: the attribute went to "dark" and the
 * group went on showing « Système » checked.
 *
 * It is also what `getSnapshot` reads, and `getSnapshot` runs at least once per
 * render: asking storage there was a synchronous call on every render of the
 * screen for no gain. Measured before: three reads to mount the account screen,
 * five after typing three letters into the name field, which is not this
 * control's business.
 */
let applied: ThemePreference = readThemePreference()

/**
 * index.html carries two media-scoped `theme-color` tags, which is the right
 * answer while the system decides. An explicit choice cannot be expressed as a
 * media query, so it gets a tag of its own with no media — inserted **first**,
 * because the browser uses the first tag in tree order whose media matches, and
 * one without media always matches.
 */
function paintBrowserChrome(resolved: 'light' | 'dark', explicit: boolean) {
  const head = document.head
  const existing = head.querySelector(`#${OVERRIDE_META_ID}`)

  if (!explicit) {
    existing?.remove()

    return
  }

  const meta = existing ?? document.createElement('meta')

  meta.id = OVERRIDE_META_ID
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', CHROME[resolved])

  if (!existing) head.prepend(meta)
}

function apply(preference: ThemePreference) {
  applied = preference

  const root = document.documentElement

  if (preference === 'system') {
    root.removeAttribute('data-theme')
    paintBrowserChrome('light', false)

    return
  }

  root.setAttribute('data-theme', preference)
  paintBrowserChrome(preference, true)
}

const listeners = new Set<() => void>()

const announce = () => {
  for (const listener of listeners) listener()
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // A theme that cannot be remembered still applies for this session.
  }

  apply(preference)
  announce()
}

/**
 * Applies the stored preference and starts following the other tabs.
 *
 * Both belong here rather than in `subscribe`. A tab that never renders the
 * settings screen never calls the hook, so a listener installed by `subscribe`
 * would not exist there — and that is the tab the change has to reach: choosing
 * dark on the settings screen left a dashboard open elsewhere on the light
 * palette until it was reloaded.
 *
 * Called before React renders, so a stored "dark" is on the root element by the
 * time the application paints. The stylesheet still paints first and knows only
 * the system preference, which is why index.html carries a blocking snippet
 * that writes the same attribute — this is the second of the two.
 */
export function installTheme() {
  apply(readThemePreference())

  window.addEventListener('storage', (event) => {
    // `null` is a whole-storage clear, which counts. Any other key does not.
    if (event.key !== STORAGE_KEY && event.key !== null) return

    apply(readThemePreference())
    announce()
  })
}

const subscribe = (onStoreChange: () => void) => {
  listeners.add(onStoreChange)

  return () => {
    listeners.delete(onStoreChange)
  }
}

const getSnapshot = () => applied

export function useThemePreference() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'system' as const)
}

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
 * Called before React renders, so a stored "dark" is on the root element by the
 * first paint. Doing it in an effect would show one frame of the wrong theme.
 */
export function installTheme() {
  apply(readThemePreference())
}

const subscribe = (onStoreChange: () => void) => {
  listeners.add(onStoreChange)

  // Another tab is another store. Without this, choosing dark in one tab left
  // the others on light until they were reloaded.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return

    apply(readThemePreference())
    onStoreChange()
  }

  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useThemePreference() {
  return useSyncExternalStore(subscribe, readThemePreference, () => 'system' as const)
}

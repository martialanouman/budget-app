import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query currently matches.
 *
 * The shell picks its navigation in JavaScript rather than rendering both and
 * hiding one with `md:hidden`, and that is a deliberate trade. Two navigations
 * in the document means two `<nav>` landmarks and two links called "Comptes";
 * `display: none` keeps the hidden one out of the accessibility tree, but it
 * stays in the DOM, and anything reading the document rather than the rendered
 * page sees both. The journeys are exactly that reader — they mount the router
 * without a stylesheet — so a duplicated tab bar would have made
 * `getByRole('link', { name: 'Comptes' })` ambiguous in eight existing files.
 *
 * One navigation at a time, therefore, and the width decides which.
 *
 * `subscribe` is memoised, and that is not decoration: `useSyncExternalStore`
 * re-runs it whenever its identity changes, so an inline closure tears the
 * listener down and puts it back on every render. Measured before the fix, 4
 * subscriptions and 3 removals for one mount and one navigation. `useAuth`
 * keeps both of its callbacks at module scope for the same reason; this one
 * takes a parameter, so it memoises instead.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)

      list.addEventListener('change', onChange)

      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** The width at which the rail replaces the tab bar. Tailwind's `md`. */
export const WIDE_SCREEN = '(min-width: 48rem)'

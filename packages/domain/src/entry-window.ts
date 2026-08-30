/**
 * How long an entry stays correctable (TRX-05). The window runs from when the
 * entry was recorded, never from the date it carries: an expense backdated to
 * last month but typed today is still a fresh mistake. What the deadline
 * protects is the settled history, not the user's memory.
 */
export const EDIT_WINDOW_DAYS = 30

const DAY_IN_MS = 86_400_000

/**
 * PocketBase stamps `created` as `2026-08-30 12:00:00.000Z` — a space, not the
 * `T` of ISO-8601. goja's Date parser does not accept that form, so the hooks
 * would read NaN off every record they were given. Normalising the separator
 * costs one replacement and is the difference between a rule that works on the
 * server and one that only works in a browser.
 */
function instantOf(timestamp: string): number {
  if (typeof timestamp !== 'string') return Number.NaN

  return Date.parse(timestamp.replace(' ', 'T'))
}

/**
 * Whether an entry recorded at `createdAt` may still be changed or removed at
 * `now`. Both instants are arguments rather than a call to the clock: that is
 * what lets the rule be pinned by a test, and what lets the same function serve
 * the button on screen and the guard in the hook.
 *
 * Every refusal is a "no": the Money brand and the TypeScript signature are
 * both erased before goja ever sees this, so an unreadable timestamp closes the
 * window rather than opening it. Silently allowing an edit is the one outcome
 * that cannot be taken back.
 */
export function remainsEditable(createdAt: string, now: string): boolean {
  const recorded = instantOf(createdAt)
  const current = instantOf(now)

  if (Number.isNaN(recorded) || Number.isNaN(current)) return false

  const age = current - recorded

  // A record stamped after the clock means one of the two is wrong, and which
  // one is unknowable from here. Refusing keeps the deadline from being
  // sidestepped by a timestamp nobody vouches for.
  if (age < 0) return false

  return age <= EDIT_WINDOW_DAYS * DAY_IN_MS
}

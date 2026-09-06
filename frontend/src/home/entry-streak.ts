import { useQuery } from '@tanstack/react-query'
import { type EntryStreak } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

/**
 * The one row the view holds for this user, or null when there is none.
 *
 * Null and not `undefined`: a query function that returns `undefined` is
 * refused by TanStack Query, which logs "Query data cannot be undefined" and
 * leaves the query in error. It has been doing so on every screen that mounts
 * the dashboard since PR 5/7 — harmless to the reader, since the card already
 * treats no run as no run, but it filled the journey output with an error that
 * would have hidden a real one.
 */
export function useEntryStreak() {
  return useQuery({
    queryKey: ['entry-streak'],
    queryFn: async () =>
      (await pb.collection('entry_streaks').getFullList<EntryStreak>())[0] ?? null,
  })
}

const twoDigits = (value: number) => String(value).padStart(2, '0')

/**
 * The calendar day before `date`, which is the only other day a run may end on
 * and still be standing.
 *
 * Arithmetic on the string, with no UTC anywhere, and that is a correction. A
 * first version built a Date at local noon, stepped back a day and read it
 * through `toISOString()` — which converts to UTC. Measured under node with TZ
 * set: correct at UTC, Abidjan, Auckland and São Paulo, and off by one past
 * UTC+12, where `dayBefore('2026-09-05')` answered `2026-09-03`. A standing
 * streak would have read "aucune série" in Kiritimati. `todayLocally` dodges
 * the same trap by subtracting the offset before converting; this one dodges it
 * by never converting.
 *
 * The month rollover still asks a Date for February's length, but builds and
 * reads it with local accessors only — day zero of a month is the last day of
 * the one before, which spares us a leap-year rule of our own.
 *
 * Not covered by a journey: the suite runs one browser and cannot vary its
 * timezone per test, and a helper that re-derived the expected day would only
 * restate the implementation.
 */
function dayBefore(date: string) {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]

  if (day > 1) return `${year}-${twoDigits(month)}-${twoDigits(day - 1)}`

  const earlier = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const lastDay = new Date(earlier.year, earlier.month, 0).getDate()

  return `${earlier.year}-${twoDigits(earlier.month)}-${twoDigits(lastDay)}`
}

/**
 * How the run reads today (RAP-06).
 *
 * The view says how long the run is and which day it ends on, never whether
 * that day is today: its only clock would be SQLite's `date('now')`, which is
 * UTC, and this repo holds that the day belongs to the user's timezone. So the
 * comparison happens here, where the local date is known.
 *
 * A run that ended yesterday is still standing. At eight in the morning nobody
 * has typed anything yet, and answering "aucune série" would punish opening the
 * app early — the screen owes the nudge instead, since today is what keeps it.
 */
export function runToday(streak: EntryStreak | null | undefined, today: string) {
  if (!streak || streak.days <= 0) return undefined

  const last = streak.last_day.slice(0, 10)

  if (last !== today && last !== dayBefore(today)) return undefined

  return { days: streak.days, holdsToday: last === today }
}

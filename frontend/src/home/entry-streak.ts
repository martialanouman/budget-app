import { useQuery } from '@tanstack/react-query'
import { type EntryStreak } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

export function useEntryStreak() {
  return useQuery({
    queryKey: ['entry-streak'],
    queryFn: async () => (await pb.collection('entry_streaks').getFullList<EntryStreak>())[0],
  })
}

/** The local calendar day before `date`, which is the only one a run may end on and still stand. */
function dayBefore(date: string) {
  const day = new Date(`${date}T12:00:00`)

  day.setDate(day.getDate() - 1)

  return day.toISOString().slice(0, 10)
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
export function runToday(streak: EntryStreak | undefined, today: string) {
  if (!streak || streak.days <= 0) return undefined

  const last = streak.last_day.slice(0, 10)

  if (last !== today && last !== dayBefore(today)) return undefined

  return { days: streak.days, holdsToday: last === today }
}

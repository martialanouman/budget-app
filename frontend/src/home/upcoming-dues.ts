import { daysUntil, instalmentDueDate, nextDueDate } from '@budget/domain'
import { type Debt } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'

export type Due = { debt: Debt; date: string; inDays: number }

/**
 * RAP-01's upcoming instalments. Only debts still running have one, and never
 * before the schedule's own first instalment — the reminders job holds the
 * same rule, and the two readings of the calendar must not contradict each
 * other on screen.
 *
 * Recurring transactions join this list in v1.1; the specs name them here,
 * they do not exist yet.
 */
export function upcomingDues(debts: Debt[], today = todayLocally()): Due[] {
  return debts
    .filter((debt) => debt.status === 'active')
    .map((debt) => {
      const date = nextDueDate(today, debt.due_day)
      const first = instalmentDueDate(debt.start_date.slice(0, 10), debt.due_day, 0)

      return { debt, date: date < first ? first : date }
    })
    .map(({ debt, date }) => ({ debt, date, inDays: daysUntil(today, date) }))
    .sort((a, b) => a.inDays - b.inDays)
}

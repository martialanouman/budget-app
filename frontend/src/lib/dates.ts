/**
 * Today in the user's own timezone. `toISOString()` alone would return the UTC
 * day, which is the previous one for anyone west of Greenwich for part of the
 * evening — an entry typed at 23:00 in Abidjan would land on the wrong day.
 */
export function todayLocally() {
  const now = new Date()

  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** The budget month a date belongs to. Budget months are calendar months. */
export const monthOf = (date: string) => date.slice(0, 7)

/** The month before `YYYY-MM`, rolling the year over in January. */
export function previousMonth(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number]

  return index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, '0')}`
}

/** The month after `YYYY-MM`, rolling the year over in December. */
export function nextMonth(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number]

  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`
}

/**
 * Every month from `earliest` to `latest`, newest first, both included. Used to
 * offer a month filter that reaches as far back as the history does and no
 * further — a fixed window would either hide old entries or offer months the
 * owner never used.
 *
 * Bounded so a corrupt date cannot spin here: a month is a single row read from
 * the server, and no one has a hundred years of expenses.
 */
export function monthsFrom(earliest: string, latest: string) {
  const months: string[] = []

  for (
    let month = latest;
    month >= earliest && months.length < 1200;
    month = previousMonth(month)
  ) {
    months.push(month)
  }

  return months
}

// Intl rather than a date library: the only need is a month name, and the
// browser already carries the French one. A parser will earn its dependency
// when something actually has to compute on dates.
const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

export const monthLabel = (month: string) => MONTH_LABEL.format(new Date(`${month}-01T00:00:00`))

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** A calendar day as a French reader writes it, never as the API stores it. */
export const dayLabel = (date: string) =>
  DAY_LABEL.format(new Date(`${date.slice(0, 10)}T00:00:00`))

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

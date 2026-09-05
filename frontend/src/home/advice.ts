import { type Money, formatAmount, toMoney } from '@budget/domain'

/** How many days the month has left, today included. */
export function daysLeftInMonth(today: string) {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  // Day zero of the next month is the last day of this one.
  const lastDay = new Date(year, month, 0).getDate()

  return lastDay - day + 1
}

/**
 * RAP-07: one written sentence, chosen by explicit rules from what is left to
 * live on and how much of the month remains. Nothing is generated at runtime —
 * the wordings below are the whole vocabulary, and the rules pick one.
 *
 * What the counsel adds is the per-day framing. A month's remainder is not a
 * figure anyone can act on; what is left per day until the month ends is, and
 * it is the only arithmetic here.
 *
 * It never repeats the amount printed above it. A first version opened with
 * "Il reste X", two centimetres under the same X in three times the type — and
 * an existing journey said so by matching that figure twice.
 *
 * The division floors, and that direction is not arbitrary: rounding up would
 * hand out a daily allowance the month cannot pay.
 */
export function adviceFor(remaining: Money | undefined, daysLeft: number) {
  if (remaining === undefined) return undefined

  if (remaining < 0) {
    return 'Vous avez engagé plus que vos revenus du mois. Revoyez vos enveloppes avant la prochaine dépense.'
  }

  if (remaining === 0) {
    return 'Il ne reste rien à vivre ce mois-ci. Toute dépense entamera le mois prochain.'
  }

  // A last day has nothing to spread: the month ends tonight.
  if (daysLeft <= 1) return 'Dernier jour du mois : ce qui reste ne se répartit plus.'

  const perDay = toMoney(Math.floor(remaining / daysLeft))

  return `Soit ${formatAmount(perDay)} par jour sur les ${daysLeft} jours qui restent.`
}

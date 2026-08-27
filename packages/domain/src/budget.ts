import { type Money, toMoney } from './money.ts'

/** Percentages of a cap that deserve their own alert (BUD-04). */
export const BUDGET_THRESHOLDS = [80, 100] as const

export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number]

/**
 * Which alert thresholds the spending has reached. Stated as a property of the
 * current total rather than of a crossing: an entry can be deleted and typed
 * again, and the caller must be free to ask this question at any moment
 * without keeping a history.
 *
 * The comparison multiplies instead of dividing — a percentage of a franc
 * amount is rarely a whole number, and rounding it would fire an alert a franc
 * early or late.
 */
export function reachedThresholds(cap: Money, spent: Money): BudgetThreshold[] {
  const ceiling = toMoney(cap)
  const total = toMoney(spent)

  if (ceiling <= 0) return []

  return BUDGET_THRESHOLDS.filter((threshold) => total * 100 >= ceiling * threshold)
}

/**
 * What an envelope has left. Never negative: an overspent envelope carries
 * nothing forward, and carrying a debt would shrink next month's cap without
 * the user ever choosing it (BUD-06).
 */
export function unspent(cap: Money, spent: Money): Money {
  return toMoney(Math.max(toMoney(cap) - toMoney(spent), 0))
}

/**
 * BUD-05. The specs write "revenus − charges fixes − échéances de dettes −
 * dépenses réalisées", which deducts a fixed charge twice once it has been
 * paid: as a charge, then as a real expense. Only the unpaid part of the fixed
 * envelopes is deducted here, so the figure keeps meaning "what is still free
 * to spend".
 *
 * The result is signed: a month that does not balance says so.
 */
export function remainingToLive(month: {
  income: Money
  spent: Money
  unpaidFixedCharges: Money
  debtInstalments: Money
}): Money {
  return toMoney(
    toMoney(month.income) -
      toMoney(month.spent) -
      toMoney(month.unpaidFixedCharges) -
      toMoney(month.debtInstalments),
  )
}

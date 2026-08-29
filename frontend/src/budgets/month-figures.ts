import { remainingToLive, toMoney, unspent } from '@budget/domain'
import { unpaidInstalments } from '@/debts/debt-figures.ts'
import { type Budget, type BudgetSpending, type Debt, type DebtPayment } from '@/lib/collections'

/** The effective ceiling of an envelope: its own cap plus anything carried in. */
export const ceilingOf = (budget: Budget) => toMoney(budget.cap_amount + budget.carried_amount)

export const spentByCategory = (spending: BudgetSpending[]) =>
  new Map(spending.map((row) => [row.category, row.spent]))

/**
 * What the fixed envelopes still have to pay this month. Only the unpaid part
 * counts: what has already been paid is counted once, as spending. Deducting
 * the whole charge as well would make paying the rent lower the figure twice.
 */
export function unpaidFixedCharges(budgets: Budget[], spending: BudgetSpending[]) {
  const spent = spentByCategory(spending)

  return budgets
    .filter((budget) => budget.expand?.category?.kind === 'fixe')
    .reduce(
      (total, budget) =>
        toMoney(total + unspent(ceilingOf(budget), toMoney(spent.get(budget.category) ?? 0))),
      toMoney(0),
    )
}

/**
 * BUD-05, shared by the budgets screen and the dashboard so the two can never
 * disagree about the same month.
 */
export function remainingThisMonth(month: {
  income: number
  spent: number
  budgets: Budget[]
  spending: BudgetSpending[]
  debts: Debt[]
  payments: DebtPayment[]
}) {
  return remainingToLive({
    income: toMoney(month.income),
    spent: toMoney(month.spent),
    unpaidFixedCharges: unpaidFixedCharges(month.budgets, month.spending),
    debtInstalments: unpaidInstalments(month.debts, month.payments),
  })
}

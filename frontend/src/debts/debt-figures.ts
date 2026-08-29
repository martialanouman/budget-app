import { amortisationSchedule, instalmentDueDate, toMoney, unpaidInstalment } from '@budget/domain'
import { type Debt, type DebtPayment } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'

/**
 * What is left to repay. Zero is an answer, not a missing value: testing the
 * figure for truthiness sent a debt repaid to the last franc back to
 * displaying what had been borrowed, with a full schedule still to come.
 */
export const owedOn = (debt: Debt) => toMoney(debt.remaining_amount ?? debt.initial_amount)

/**
 * DET-05. Counted from what is still owed rather than from what was borrowed:
 * a debt half repaid ends sooner than its original terms said, and that is the
 * whole point of showing the date.
 *
 * Undefined when the terms never repay the capital — a payment smaller than
 * the monthly interest has no end date to show, and inventing one would be a
 * lie the borrower could act on.
 */
export function estimatedEnd(debt: Debt): string | undefined {
  if (owedOn(debt) <= 0) return undefined

  try {
    const schedule = amortisationSchedule({
      principal: owedOn(debt),
      monthlyPayment: toMoney(debt.monthly_payment),
      annualRatePercent: debt.interest_rate,
    })

    return instalmentDueDate(todayLocally(), debt.due_day, schedule.length - 1)
  } catch {
    return undefined
  }
}

export function scheduleOf(debt: Debt) {
  if (owedOn(debt) <= 0) return []

  try {
    return amortisationSchedule({
      principal: owedOn(debt),
      monthlyPayment: toMoney(debt.monthly_payment),
      annualRatePercent: debt.interest_rate,
    }).map((instalment, index) => ({
      ...instalment,
      dueDate: instalmentDueDate(todayLocally(), debt.due_day, index),
    }))
  } catch {
    return []
  }
}

/** Only what the user owes weighs on them; money owed to them does not. */
const isOwedByUser = (debt: Debt) => debt.direction === 'je_dois' && debt.status === 'active'

export const totalOwed = (all: Debt[]) =>
  toMoney(all.filter(isOwedByUser).reduce((sum, debt) => sum + owedOn(debt), 0))

export const monthlyCommitment = (all: Debt[]) =>
  toMoney(all.filter(isOwedByUser).reduce((sum, debt) => sum + debt.monthly_payment, 0))

/**
 * The share of the month's income the repayments take, as whole percents.
 * Undefined without income: a share of nothing is not zero, it is unknown, and
 * "0 %" would read as comfort.
 */
export function shareOfIncome(all: Debt[], income: number): number | undefined {
  if (income <= 0) return undefined

  return Math.round((monthlyCommitment(all) * 100) / income)
}

/**
 * What the debts still claim from this month's money (BUD-05). Money owed to
 * the user claims nothing: it is not a charge, and the same rule already
 * decides the total owed and the monthly commitment.
 */
export function unpaidInstalments(all: Debt[], paidThisMonth: DebtPayment[]) {
  const paid = new Map<string, number>()

  for (const payment of paidThisMonth) {
    paid.set(payment.debt, (paid.get(payment.debt) ?? 0) + payment.amount)
  }

  return toMoney(
    all
      .filter(isOwedByUser)
      .reduce(
        (sum, debt) =>
          sum +
          unpaidInstalment(
            toMoney(debt.monthly_payment),
            owedOn(debt),
            toMoney(paid.get(debt.id) ?? 0),
          ),
        0,
      ),
  )
}

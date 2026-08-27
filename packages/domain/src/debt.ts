import { InvalidAmountError, type Money, toMoney } from './money.ts'

export type Instalment = {
  /** 1 for the first one, so it can be shown as typed. */
  number: number
  principal: Money
  interest: Money
  /** What is still owed once this instalment is paid. */
  remaining: Money
}

export type Terms = {
  principal: Money
  monthlyPayment: Money
  /** Annual nominal rate in percent, e.g. 7.5. Absent means an interest-free debt. */
  annualRatePercent?: number
}

/**
 * How one repayment divides between the month's interest and the capital.
 *
 * Interest first, capital with what is left, and never more capital than is
 * owed. A payment smaller than the interest is not an error — informal debts
 * do it routinely — it simply repays no capital.
 */
export function splitPayment(
  remaining: Money,
  amount: Money,
  annualRatePercent = 0,
): { principal: Money; interest: Money } {
  const owed = toMoney(remaining)
  const paid = toMoney(amount)

  if (paid < 0) {
    throw new InvalidAmountError(`A repayment cannot be negative, received ${paid}`)
  }

  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
    throw new InvalidAmountError(
      `An interest rate cannot be negative, received ${annualRatePercent}`,
    )
  }

  const interest = toMoney(Math.round((owed * annualRatePercent) / 1200))
  const principal = toMoney(Math.max(Math.min(paid - interest, owed), 0))

  return { principal, interest }
}

/**
 * The schedule of a debt repaid by a fixed monthly payment (DET-03).
 *
 * The payment is an input, not something derived: the user states what they
 * pay each month (DET-01). The number of instalments therefore falls out of
 * the terms, and the last one is whatever is left — smaller than the others,
 * never larger, since asking for more than is owed would take money the
 * borrower does not owe.
 *
 * Interest is a cost and never capital: whatever the monthly rounding does,
 * the principal parts add back up to exactly what was borrowed. That property
 * is what the tests hold, not the individual figures.
 *
 * A rate is a rate, not an amount — it may carry decimals. Every franc it
 * produces is rounded to a whole one immediately, so nothing fractional ever
 * survives into a stored or displayed figure.
 *
 * Direction is not this function's business: money owed and money owed to you
 * amortise identically (DET-02).
 */
export function amortisationSchedule(terms: Terms): Instalment[] {
  const principal = toMoney(terms.principal)
  const payment = toMoney(terms.monthlyPayment)
  const rate = terms.annualRatePercent ?? 0

  if (principal <= 0) {
    throw new InvalidAmountError(`A debt must have a principal above zero, received ${principal}`)
  }

  if (payment <= 0) {
    throw new InvalidAmountError(`A monthly payment must be above zero, received ${payment}`)
  }

  if (!Number.isFinite(rate) || rate < 0) {
    throw new InvalidAmountError(`An interest rate cannot be negative, received ${rate}`)
  }

  // Measured on the opening balance, where the interest is at its highest: a
  // payment that clears the first month's interest clears every later one, and
  // one that does not would leave the debt growing for ever.
  if (splitPayment(principal, payment, rate).principal === 0) {
    throw new InvalidAmountError(
      `A payment of ${payment} never repays a principal of ${principal} at ${rate}%`,
    )
  }

  const schedule: Instalment[] = []
  let owed = principal

  while (owed > 0) {
    const { principal: repaid, interest } = splitPayment(owed, payment, rate)

    owed = toMoney(owed - repaid)

    schedule.push({
      number: schedule.length + 1,
      principal: repaid,
      interest,
      remaining: owed,
    })
  }

  return schedule
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/**
 * When instalment `index` falls, counting from the month after `startDate`.
 *
 * Built from the parts rather than from a Date: `new Date(2026, 1, 31)` rolls
 * into March, which would move an instalment out of the month it belongs to.
 * A due day the month does not have falls on its last day instead.
 */
export function instalmentDueDate(startDate: string, dueDay: number, index: number): string {
  const [year, month] = startDate.split('-').map(Number) as [number, number]
  const absolute = year * 12 + (month - 1) + index + 1
  const dueYear = Math.floor(absolute / 12)
  const dueMonth = (absolute % 12) + 1

  const lastDay =
    dueMonth === 2 && isLeapYear(dueYear) ? 29 : (DAYS_IN_MONTH[dueMonth - 1] as number)
  const day = Math.min(Math.max(dueDay, 1), lastDay)

  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

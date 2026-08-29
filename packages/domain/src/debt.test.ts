import { describe, expect, it } from 'vitest'
import { InvalidAmountError, toMoney } from './money.ts'
import {
  amortisationSchedule,
  daysUntil,
  instalmentDueDate,
  nextDueDate,
  splitPayment,
  unpaidInstalment,
} from './debt.ts'

const xof = toMoney

const totalPrincipal = (schedule: { principal: number }[]) =>
  schedule.reduce((sum, one) => sum + one.principal, 0)

describe('Given a debt repaid without interest', () => {
  it('spreads the capital over whole instalments', () => {
    const schedule = amortisationSchedule({
      principal: xof(300_000),
      monthlyPayment: xof(100_000),
    })

    expect(schedule).toHaveLength(3)
    expect(schedule.map((one) => one.principal)).toEqual([100_000, 100_000, 100_000])
    expect(schedule.map((one) => one.interest)).toEqual([0, 0, 0])
    expect(schedule.at(-1)!.remaining).toBe(0)
  })

  // The last instalment is the short one: asking for a full payment that is
  // not owed would take money the borrower does not owe.
  it('closes on a smaller last instalment rather than an overpayment', () => {
    const schedule = amortisationSchedule({
      principal: xof(250_000),
      monthlyPayment: xof(100_000),
    })

    expect(schedule.map((one) => one.principal)).toEqual([100_000, 100_000, 50_000])
    expect(totalPrincipal(schedule)).toBe(250_000)
  })
})

describe('Given a debt carrying interest', () => {
  // The property that matters: interest is a cost, never capital. Whatever the
  // rounding does month to month, the capital parts must add back up to what
  // was borrowed — not one franc more, not one less.
  it('repays exactly the borrowed capital, to the franc', () => {
    const schedule = amortisationSchedule({
      principal: xof(1_000_000),
      monthlyPayment: xof(90_000),
      annualRatePercent: 12,
    })

    expect(totalPrincipal(schedule)).toBe(1_000_000)
    expect(schedule.at(-1)!.remaining).toBe(0)
  })

  it('charges interest on what is still owed, so it falls every month', () => {
    const schedule = amortisationSchedule({
      principal: xof(1_000_000),
      monthlyPayment: xof(90_000),
      annualRatePercent: 12,
    })

    expect(schedule[0]!.interest).toBe(10_000)
    expect(schedule[1]!.interest).toBeLessThan(schedule[0]!.interest)
    expect(schedule.every((one) => Number.isSafeInteger(one.interest))).toBe(true)
  })

  it('keeps every figure a whole number of francs', () => {
    const schedule = amortisationSchedule({
      principal: xof(333_333),
      monthlyPayment: xof(50_000),
      annualRatePercent: 7.5,
    })

    expect(schedule.every((one) => Number.isSafeInteger(one.principal))).toBe(true)
    expect(totalPrincipal(schedule)).toBe(333_333)
  })

  // A slow repayment is where rounding has the most chances to drift: a
  // hundred-odd instalments, each rounding its own interest.
  it('holds the capital exactly over a long schedule', () => {
    const schedule = amortisationSchedule({
      principal: xof(1_000_000),
      monthlyPayment: xof(25_000),
      annualRatePercent: 24,
    })

    expect(schedule.length).toBeGreaterThan(60)
    expect(totalPrincipal(schedule)).toBe(1_000_000)
    expect(schedule.at(-1)!.remaining).toBe(0)
  })

  // A payment that does not cover the month's interest never repays anything:
  // the schedule would run forever, and the borrower would owe more each month.
  it('refuses a payment too small to ever repay the capital', () => {
    expect(() =>
      amortisationSchedule({
        principal: xof(1_000_000),
        monthlyPayment: xof(10_000),
        annualRatePercent: 12,
      }),
    ).toThrow(InvalidAmountError)
  })
})

describe('Given invalid terms', () => {
  it.each([
    ['a principal of zero', { principal: 0, monthlyPayment: 50_000 }],
    ['a payment of zero', { principal: 100_000, monthlyPayment: 0 }],
    ['a negative principal', { principal: -100_000, monthlyPayment: 50_000 }],
  ])('refuses %s', (_, terms) => {
    expect(() =>
      amortisationSchedule({
        principal: xof(terms.principal),
        monthlyPayment: xof(terms.monthlyPayment),
      }),
    ).toThrow(InvalidAmountError)
  })

  it('refuses a negative rate', () => {
    expect(() =>
      amortisationSchedule({
        principal: xof(100_000),
        monthlyPayment: xof(50_000),
        annualRatePercent: -3,
      }),
    ).toThrow(InvalidAmountError)
  })
})

describe('Given a due day and a starting date', () => {
  it('falls on the same day each month', () => {
    expect(instalmentDueDate('2026-08-19', 5, 0)).toBe('2026-09-05')
    expect(instalmentDueDate('2026-08-19', 5, 1)).toBe('2026-10-05')
  })

  // The 31st does not exist every month, and rolling into the next one would
  // move an instalment out of the month it belongs to.
  it('falls back to the last day of a shorter month', () => {
    expect(instalmentDueDate('2026-01-10', 31, 0)).toBe('2026-02-28')
    expect(instalmentDueDate('2024-01-10', 31, 0)).toBe('2024-02-29')
  })

  it('rolls the year over in December', () => {
    expect(instalmentDueDate('2026-11-02', 15, 1)).toBe('2027-01-15')
  })
})

describe('Given a repayment to break down', () => {
  it('takes the month’s interest first, the rest off the capital', () => {
    expect(splitPayment(xof(1_000_000), xof(90_000), 12)).toEqual({
      interest: 10_000,
      principal: 80_000,
    })
  })

  it('puts everything on the capital when no interest is owed', () => {
    expect(splitPayment(xof(300_000), xof(100_000), 0)).toEqual({
      interest: 0,
      principal: 100_000,
    })
  })

  // Overpaying does not repay more than is owed; the surplus is not capital.
  it('never repays more capital than remains', () => {
    expect(splitPayment(xof(50_000), xof(200_000), 0)).toEqual({
      interest: 0,
      principal: 50_000,
    })
  })

  // A real borrower can pay less than the interest — informal debts do it all
  // the time. It is not an error, it simply repays no capital.
  it('repays no capital when the payment does not cover the interest', () => {
    expect(splitPayment(xof(1_000_000), xof(5_000), 12)).toEqual({
      interest: 10_000,
      principal: 0,
    })
  })

  it('refuses a negative payment', () => {
    expect(() => splitPayment(xof(100_000), xof(-1), 0)).toThrow(InvalidAmountError)
  })
})

describe('Given a due day and today’s date', () => {
  it('points at this month while the day is still to come', () => {
    expect(nextDueDate('2026-08-19', 25)).toBe('2026-08-25')
  })

  // On the day itself the instalment is still due: it has not been missed yet.
  it('points at today when the day has arrived', () => {
    expect(nextDueDate('2026-08-25', 25)).toBe('2026-08-25')
  })

  it('moves to next month once the day has passed', () => {
    expect(nextDueDate('2026-08-26', 25)).toBe('2026-09-25')
    expect(nextDueDate('2026-12-31', 5)).toBe('2027-01-05')
  })

  it('falls on the last day of a month too short for it', () => {
    expect(nextDueDate('2026-02-01', 31)).toBe('2026-02-28')
  })
})

describe('Given two dates', () => {
  it('counts the days between them', () => {
    expect(daysUntil('2026-08-19', '2026-08-22')).toBe(3)
    expect(daysUntil('2026-08-19', '2026-08-19')).toBe(0)
  })

  it('counts across a month and a year boundary', () => {
    expect(daysUntil('2026-08-30', '2026-09-02')).toBe(3)
    expect(daysUntil('2026-12-31', '2027-01-01')).toBe(1)
  })

  // Deliberate: a due date already behind is not "minus three days away", it
  // is missed, and the caller must be able to tell the two apart.
  it('goes negative for a date already behind', () => {
    expect(daysUntil('2026-08-19', '2026-08-16')).toBe(-3)
  })
})

describe('Given a debt whose instalment falls this month', () => {
  it('still claims the whole instalment while nothing has been repaid', () => {
    expect(unpaidInstalment(xof(90_000), xof(900_000), xof(0))).toBe(90_000)
  })

  // Symmetrical to the fixed envelopes: what has already been repaid is
  // counted once, as spending. Deducting the instalment whole as well would
  // make paying it lower the figure twice.
  it('claims only what is left of it once part has been repaid', () => {
    expect(unpaidInstalment(xof(90_000), xof(900_000), xof(50_000))).toBe(40_000)
  })

  it('claims nothing once the instalment has been paid, or overpaid', () => {
    expect(unpaidInstalment(xof(90_000), xof(900_000), xof(90_000))).toBe(0)
    expect(unpaidInstalment(xof(90_000), xof(900_000), xof(120_000))).toBe(0)
  })

  // The last instalment is the short one, here as in the schedule: asking for
  // more than is owed would take money the borrower does not owe.
  it('never claims more than is still owed', () => {
    expect(unpaidInstalment(xof(90_000), xof(30_000), xof(0))).toBe(30_000)
  })

  it('claims nothing from a debt already settled', () => {
    expect(unpaidInstalment(xof(90_000), xof(0), xof(0))).toBe(0)
  })
})

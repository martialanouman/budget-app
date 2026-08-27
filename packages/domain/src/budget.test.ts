import { describe, expect, it } from 'vitest'
import { toMoney } from './money.ts'
import { BUDGET_THRESHOLDS, reachedThresholds, remainingToLive, unspent } from './budget.ts'

const xof = toMoney

describe('Given a spending cap on a category', () => {
  it('stays silent below the first threshold', () => {
    expect(reachedThresholds(xof(100_000), xof(79_999))).toEqual([])
  })

  it('reports the warning threshold once four fifths are spent', () => {
    expect(reachedThresholds(xof(100_000), xof(80_000))).toEqual([80])
  })

  // Both are reported, not only the last: a single large expense can cross the
  // two at once, and each threshold owes the user its own alert.
  it('reports both thresholds when one expense crosses them together', () => {
    expect(reachedThresholds(xof(100_000), xof(120_000))).toEqual([80, 100])
  })

  // The comparison is on whole francs — 80% of 33 333 is not an integer, and
  // rounding it either way would fire the alert one franc early or late.
  it('compares exactly, without rounding the threshold to a franc', () => {
    expect(reachedThresholds(xof(33_333), xof(26_666))).toEqual([])
    expect(reachedThresholds(xof(33_333), xof(26_667))).toEqual([80])
  })

  it('reports nothing when no cap has been set', () => {
    expect(reachedThresholds(xof(0), xof(50_000))).toEqual([])
  })

  it('exposes its thresholds so the interface never restates them', () => {
    expect(BUDGET_THRESHOLDS).toEqual([80, 100])
  })
})

describe('Given a category budget at the end of a month', () => {
  it('carries what was not spent', () => {
    expect(unspent(xof(100_000), xof(80_000))).toBe(20_000)
  })

  // An overspent envelope carries nothing; carrying a debt would silently
  // shrink next month's cap without the user ever choosing it.
  it('carries nothing from an overspent envelope', () => {
    expect(unspent(xof(100_000), xof(130_000))).toBe(0)
  })
})

describe('Given a month in progress', () => {
  // The specs write "revenus − charges fixes − échéances − dépenses réalisées",
  // which counts a paid fixed charge twice: once as a charge, once as a real
  // expense. Only what remains to be paid on the fixed envelopes is deducted.
  it('deducts fixed charges only for the part still unpaid', () => {
    const left = remainingToLive({
      income: xof(500_000),
      spent: xof(120_000),
      unpaidFixedCharges: xof(80_000),
      debtInstalments: xof(50_000),
    })

    expect(left).toBe(250_000)
  })

  it('goes negative rather than pretending the month balances', () => {
    const left = remainingToLive({
      income: xof(100_000),
      spent: xof(90_000),
      unpaidFixedCharges: xof(30_000),
      debtInstalments: xof(0),
    })

    expect(left).toBe(-20_000)
  })
})

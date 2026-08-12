import { describe, expect, it } from 'vitest'
import {
  InvalidAmountError,
  addMoney,
  allocate,
  parseAmount,
  subtractMoney,
  toMoney,
} from './money.ts'

describe('Given an amount to validate', () => {
  it('accepts a whole number of francs', () => {
    expect(toMoney(150_000)).toBe(150_000)
  })

  it('rejects fractions, which the franc does not have', () => {
    expect(() => toMoney(1500.5)).toThrow(InvalidAmountError)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects %s',
    (value) => {
      expect(() => toMoney(value)).toThrow(InvalidAmountError)
    },
  )
})

describe('Given a user typing an amount', () => {
  // Users copy amounts back from the UI, where Intl separates thousands with
  // U+202F and U+00A0 rather than a plain space.
  it.each(['150000', '150 000', '150 000', '150 000'])('reads "%s" as 150000', (input) => {
    expect(parseAmount(input)).toBe(150_000)
  })

  it('reads a negative amount', () => {
    expect(parseAmount('-2 500')).toBe(-2500)
  })

  it.each(['', '   ', '1500,50', '1500.50', '12a', 'abc'])('rejects "%s"', (input) => {
    expect(() => parseAmount(input)).toThrow(InvalidAmountError)
  })
})

describe('Given two amounts', () => {
  it('adds them', () => {
    expect(addMoney(toMoney(150_000), toMoney(2_500))).toBe(152_500)
  })

  it('subtracts them, going below zero when spending exceeds income', () => {
    expect(subtractMoney(toMoney(10_000), toMoney(12_000))).toBe(-2_000)
  })
})

describe('Given an amount to split across categories', () => {
  it('splits evenly when it divides exactly', () => {
    expect(allocate(toMoney(90_000), [1, 1, 1])).toEqual([30_000, 30_000, 30_000])
  })

  it('gives the leftover francs to the largest remainders', () => {
    // 100 / 3 leaves 1 franc over: exactly one part must absorb it.
    expect(allocate(toMoney(100), [1, 1, 1])).toEqual([34, 33, 33])
  })

  it('respects unequal weights', () => {
    expect(allocate(toMoney(10_000), [3, 1])).toEqual([7_500, 2_500])
  })

  it.each([
    [toMoney(100), [1, 1, 1]],
    [toMoney(10_001), [7, 3, 1]],
    [toMoney(1), [1, 1, 1, 1]],
    [toMoney(-100), [1, 1, 1]],
    [toMoney(999_999), [5, 3, 2, 1]],
  ])('conserves the total exactly for %i across %j', (total, weights) => {
    const parts = allocate(total, weights)

    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total)
    expect(parts).toHaveLength(weights.length)
  })

  it('ignores parts weighted zero', () => {
    expect(allocate(toMoney(1_000), [1, 0])).toEqual([1_000, 0])
  })

  it.each([[[]], [[0, 0]], [[-1, 2]], [[Number.NaN, 1]]])('rejects the weights %j', (weights) => {
    expect(() => allocate(toMoney(1_000), weights)).toThrow(InvalidAmountError)
  })
})

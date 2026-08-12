declare const brand: unique symbol

/** A validated whole number of XOF francs. The franc has no subunit. */
export type Money = number & { readonly [brand]: 'XOF' }

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidAmountError'
  }
}

export function toMoney(value: number): Money {
  // Number.isInteger also rejects NaN and both infinities.
  if (!Number.isInteger(value)) {
    throw new InvalidAmountError(`Expected a whole number of francs, received ${value}`)
  }

  return value as Money
}

export const ZERO = toMoney(0)

/**
 * Parses user input. Spaces of any kind are thousands separators and are
 * dropped; anything else — decimals included — is rejected.
 */
export function parseAmount(input: string): Money {
  const digits = input.replace(/\s/gu, '')

  if (!/^-?\d+$/.test(digits)) {
    throw new InvalidAmountError(`Not a whole amount in francs: "${input}"`)
  }

  return toMoney(Number(digits))
}

export function addMoney(a: Money, b: Money): Money {
  return toMoney(a + b)
}

export function subtractMoney(a: Money, b: Money): Money {
  return toMoney(a - b)
}

/**
 * Splits `total` proportionally to `weights`, giving the leftover francs to the
 * largest fractional parts. The returned parts always sum back to `total`: the
 * franc has no subunit, so a split must never invent or lose one.
 */
export function allocate(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) {
    throw new InvalidAmountError('Cannot allocate across zero parts')
  }

  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new InvalidAmountError('Weights must be finite and non-negative')
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  if (totalWeight <= 0) {
    throw new InvalidAmountError('Weights must not all be zero')
  }

  const exact = weights.map((weight) => (total * weight) / totalWeight)
  const parts = exact.map(Math.floor)
  const leftover = total - parts.reduce((sum, part) => sum + part, 0)

  const byLargestRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)

  for (let given = 0; given < leftover; given += 1) {
    const target = byLargestRemainder[given % byLargestRemainder.length]!

    parts[target.index] = parts[target.index]! + 1
  }

  return parts.map(toMoney)
}

import { describe, expect, it } from 'vitest'
import { formatAmount } from './format.ts'
import { toMoney } from './money.ts'

// Matched with \s rather than a literal space: Intl uses narrow and non-breaking
// spaces whose exact code points depend on the ICU version bundled with Node.
describe('Given an amount in XOF', () => {
  it('formats it as whole francs with a thousands separator', () => {
    expect(formatAmount(toMoney(150_000))).toMatch(/^150\s000\sF\sCFA$/u)
  })

  it('formats a small amount without a separator', () => {
    expect(formatAmount(toMoney(500))).toMatch(/^500\sF\sCFA$/u)
  })

  it('keeps the sign on a negative amount', () => {
    expect(formatAmount(toMoney(-2_500))).toMatch(/^-2\s500\sF\sCFA$/u)
  })
})

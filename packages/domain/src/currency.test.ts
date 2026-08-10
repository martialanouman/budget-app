import { describe, expect, it } from 'vitest'
import { CURRENCY_CODE, CURRENCY_LOCALE } from './index.ts'

const format = (amount: number) =>
  new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
  }).format(amount)

// Matched with \s rather than a literal space: Intl uses narrow and non-breaking
// spaces whose exact code points depend on the ICU version bundled with Node.
describe('Given an amount in XOF', () => {
  it('formats it as whole francs with a thousands separator', () => {
    expect(format(150_000)).toMatch(/^150\s000\sF\sCFA$/u)
  })

  it('never shows decimals, since the franc has none', () => {
    expect(format(1500.75)).toMatch(/^1\s501\sF\sCFA$/u)
  })
})

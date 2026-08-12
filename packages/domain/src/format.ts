import type { Money } from './money.ts'

export const CURRENCY_CODE = 'XOF' as const
export const CURRENCY_LOCALE = 'fr-FR' as const

// Browser-only on purpose. PocketBase's goja engine has no Intl at all, and
// Number.prototype.toLocaleString there reads its argument as a toString radix
// rather than a locale. Keep this module out of ./server.ts.
const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
})

export function formatAmount(amount: Money): string {
  return formatter.format(amount)
}

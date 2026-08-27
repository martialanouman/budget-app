import { describe, expect, it } from 'vitest'
import * as server from './server.ts'

// The hooks call this bundle from goja, untyped: a function missing from the
// server entry point is not a compile error anywhere, it is an HTTP 400 on
// whatever the user was doing. Measured once already — a repayment refused
// because `splitPayment` had never been exported, while every domain test
// stayed green by importing the module directly.
//
// Formatting is deliberately absent: `format.ts` builds an Intl.NumberFormat
// when it loads, and goja has no Intl at all, so exporting it here would take
// every hook down at startup.
describe('Given the entry point bundled for PocketBase', () => {
  it.each([
    'toMoney',
    'addMoney',
    'subtractMoney',
    'allocate',
    'parseAmount',
    'reachedThresholds',
    'unspent',
    'remainingToLive',
    'amortisationSchedule',
    'instalmentDueDate',
    'splitPayment',
    'nextDueDate',
    'daysUntil',
  ])('exposes %s to the hooks', (name) => {
    expect(typeof server[name as keyof typeof server]).toBe('function')
  })

  it('keeps localised formatting out, which goja cannot run', () => {
    expect('formatAmount' in server).toBe(false)
  })
})

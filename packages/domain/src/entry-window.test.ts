import { describe, expect, it } from 'vitest'
import { EDIT_WINDOW_DAYS, remainsEditable } from './entry-window.ts'

// PocketBase's own wire format: a space rather than a T, milliseconds, and a
// trailing Z. Every timestamp below is written that way on purpose — the hooks
// read `created` straight off the record, and a parser that only copes with
// ISO-8601 would pass every test here while refusing every real entry.
const NOW = '2026-08-30 12:00:00.000Z'

describe('Given an entry a user wants to correct', () => {
  it('lets them change what they typed today', () => {
    expect(remainsEditable('2026-08-30 09:15:00.000Z', NOW)).toBe(true)
  })

  it('still lets them the day before the window closes', () => {
    expect(remainsEditable('2026-08-01 12:00:00.000Z', NOW)).toBe(true)
  })

  it('refuses once the window has passed', () => {
    expect(remainsEditable('2026-07-30 11:59:59.000Z', NOW)).toBe(false)
  })

  // The boundary is the whole point of a deadline, and an off-by-one here is
  // invisible until someone loses an edit on the thirtieth day.
  it('is still open at exactly thirty days', () => {
    expect(remainsEditable('2026-07-31 12:00:00.000Z', NOW)).toBe(true)
  })

  it('is closed one millisecond later', () => {
    expect(remainsEditable('2026-07-31 11:59:59.999Z', NOW)).toBe(false)
  })

  it('states its own window so no screen restates it', () => {
    expect(EDIT_WINDOW_DAYS).toBe(30)
  })
})

// The franc-precision of this module is time, and the callers are untyped: a
// hook reads a record, the browser reads JSON. Neither can promise a shape.
describe('Given a timestamp that cannot be read', () => {
  it.each(['', 'hier', '2026-13-45 00:00:00.000Z'])('refuses %o rather than allowing it', (bad) => {
    expect(remainsEditable(bad, NOW)).toBe(false)
  })

  it('refuses when it is the clock that cannot be read', () => {
    expect(remainsEditable('2026-08-30 09:15:00.000Z', 'maintenant')).toBe(false)
  })

  it('refuses a record stamped in the future rather than trusting the clock', () => {
    expect(remainsEditable('2026-09-30 12:00:00.000Z', NOW)).toBe(false)
  })
})

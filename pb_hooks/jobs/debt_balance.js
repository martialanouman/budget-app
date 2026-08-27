// DET-03. What a debt still owes is never adjusted, only replayed.
//
// Decrementing on each payment and incrementing back on each deletion is the
// obvious design and the wrong one: a correction to an early repayment changes
// what every later one repaid, since their interest was computed on a capital
// that has just moved. One rounding error, or one deletion handled the wrong
// way, and the figure is wrong for good with nothing to compare it against.
//
// So every write to a payment replays the whole history in date order. The
// cost is a handful of records; the gain is a figure that cannot drift.
//
// Not a hook file — PocketBase only loads `*.pb.js` — but a module required by
// the handlers, which it must be: each handler runs as an isolated program.
function recompute(app, debtId) {
  if (!debtId) return

  const domain = require(`${__hooks}/lib/domain.cjs`)

  // The debt may already be gone: deleting one cascades to its repayments,
  // and each of those fires this replay. Measured — a debt carrying a single
  // repayment could not be deleted at all, and account deletion broke with it.
  let debt

  try {
    debt = app.findRecordById('debts', debtId)
  } catch {
    return
  }
  const rate = debt.get('interest_rate') || 0

  // Ordered by the day the money moved, then by insertion: two repayments on
  // the same day still have to be replayed in a stable order.
  const payments = app.findRecordsByFilter(
    'debt_payments',
    'debt = {:debt}',
    'date,created',
    0,
    0,
    { debt: debtId },
  )

  let owed = debt.getInt('initial_amount')

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i]
    const split = domain.splitPayment(owed, payment.getInt('amount'), rate)

    owed = owed - split.principal

    // Re-read before comparing, and saved only when it actually moved. The
    // save fires the update hook, which replays the whole history again; the
    // loop out here would otherwise keep comparing against copies fetched
    // before that nested pass and save every one of them in turn. Measured at
    // 366 ms for thirty repayments, growing roughly with the cube.
    const fresh = app.findRecordById('debt_payments', payment.id)

    if (
      fresh.getInt('principal_part') !== split.principal ||
      fresh.getInt('interest_part') !== split.interest
    ) {
      payment.set('principal_part', split.principal)
      payment.set('interest_part', split.interest)

      app.save(payment)
    }
  }

  const settled = owed <= 0

  if (
    debt.getInt('remaining_amount') === owed &&
    debt.get('status') === (settled ? 'soldee' : 'active')
  ) {
    return
  }

  debt.set('remaining_amount', settled ? 0 : owed)
  debt.set('status', settled ? 'soldee' : 'active')

  app.save(debt)
}

/**
 * Copies a replayed split back onto the record the API is about to answer
 * with. The replay writes through a freshly loaded copy, so without this the
 * caller is told its repayment paid no interest at all.
 */
function refresh(app, record) {
  const saved = app.findRecordById('debt_payments', record.id)

  record.set('principal_part', saved.getInt('principal_part'))
  record.set('interest_part', saved.getInt('interest_part'))
}

module.exports = { recompute: recompute, refresh: refresh }

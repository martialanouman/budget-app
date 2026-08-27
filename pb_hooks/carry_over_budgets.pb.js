// BUD-06 has two moments, not one.
//
// The cron covers envelopes that already exist when the month opens. The
// create hook covers the rest: a month duplicated on the 3rd would otherwise
// never receive the carry the cron applied on the 1st, and the user would see
// their leftover vanish without ever being told.
//
// Both call the same module, since PocketBase runs every handler as an
// isolated program and nothing can be shared through file scope.
cronAdd('carry-over-budgets', '0 2 1 * *', () => {
  const job = require(`${__hooks}/jobs/carry_over.js`)
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  job.applyCarryOver($app, month)
})

onRecordAfterCreateSuccess((e) => {
  try {
    const job = require(`${__hooks}/jobs/carry_over.js`)
    const carried = job.carriedInto(
      e.app,
      e.record.get('user'),
      e.record.get('category'),
      e.record.get('month'),
    )

    if (carried > 0) {
      e.record.set('carried_amount', carried)
      e.app.save(e.record)
    }
  } catch (err) {
    e.app.logger().error('Budget carry-over failed', 'error', String(err))
  }

  e.next()
}, 'budgets')

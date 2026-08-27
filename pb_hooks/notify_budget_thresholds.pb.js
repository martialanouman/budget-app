// BUD-04 / NOT-02. Every change to an expense re-asks the same question of the
// envelope it touches: which thresholds does it stand at now? Creation alone
// was not enough — see pb_hooks/jobs/budget_alerts.js for what that missed.
//
// Three properties these handlers must keep:
//
//   - every failure is caught and logged. An error thrown from an
//     after-success handler comes back to the client as an HTTP 400 on the
//     entry itself — measured — and an alert that cannot be written must never
//     cost the user the expense they just typed;
//   - e.next() sits outside the guarded block, so a handler further down the
//     chain that throws is not reported as an alert failure, nor run twice;
//   - an update reconciles the envelope the entry left as well as the one it
//     joined, since either can change.
//
// Everything lives inside each handler because PocketBase runs it as an
// isolated program — file-scope declarations are undefined here.
onRecordAfterCreateSuccess((e) => {
  try {
    const job = require(`${__hooks}/jobs/budget_alerts.js`)
    const record = e.record

    if (record.get('type') === 'depense') {
      job.reconcile(
        e.app,
        record.get('user'),
        record.get('category'),
        record.get('date').string().substring(0, 7),
      )
    }
  } catch (err) {
    e.app.logger().error('Budget threshold alert failed', 'error', String(err))
  }

  e.next()
}, 'transactions')

onRecordAfterUpdateSuccess((e) => {
  try {
    const job = require(`${__hooks}/jobs/budget_alerts.js`)
    const record = e.record
    const before = record.original()
    const scopes = [
      {
        category: record.get('category'),
        month: record.get('date').string().substring(0, 7),
      },
      {
        category: before.get('category'),
        month: before.get('date').string().substring(0, 7),
      },
    ]

    for (let i = 0; i < scopes.length; i++) {
      job.reconcile(e.app, record.get('user'), scopes[i].category, scopes[i].month)
    }
  } catch (err) {
    e.app.logger().error('Budget threshold alert failed', 'error', String(err))
  }

  e.next()
}, 'transactions')

onRecordAfterDeleteSuccess((e) => {
  try {
    const job = require(`${__hooks}/jobs/budget_alerts.js`)
    const record = e.record

    job.reconcile(
      e.app,
      record.get('user'),
      record.get('category'),
      record.get('date').string().substring(0, 7),
    )
  } catch (err) {
    e.app.logger().error('Budget threshold alert failed', 'error', String(err))
  }

  e.next()
}, 'transactions')

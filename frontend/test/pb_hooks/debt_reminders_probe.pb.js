// A cron cannot be reached from a journey, and the day it runs on is exactly
// what a test needs to pin. The route runs the production module itself and
// never leaves this directory.
routerAdd(
  'POST',
  '/api/test/remind-debt-dues',
  (e) => {
    const job = require(`${__hooks}/jobs/debt_reminders.js`)

    job.remind(e.app, e.requestInfo().body.today)

    return e.json(200, { ran: e.requestInfo().body.today })
  },
  $apis.requireAuth(),
)

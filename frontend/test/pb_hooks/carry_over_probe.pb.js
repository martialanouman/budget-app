// The monthly job (BUD-06) has no other way in: a cron cannot be reached from
// a journey. The route runs the production module itself rather than a copy of
// it, and never leaves this directory — the harness assembles it into a
// temporary hooks directory beside the real ones.
routerAdd(
  'POST',
  '/api/test/apply-carry-over',
  (e) => {
    const job = require(`${__hooks}/jobs/carry_over.js`)

    job.applyCarryOver(e.app, e.requestInfo().body.month)

    return e.json(200, { applied: e.requestInfo().body.month })
  },
  $apis.requireAuth(),
)

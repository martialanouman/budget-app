// The daily job of the specs (§4): every morning at 06:00, announce the
// instalments coming up. The work itself lives in
// pb_hooks/jobs/debt_reminders.js, which the harness also reaches so the job
// is tested rather than a copy of it.
cronAdd('debt-reminders', '0 6 * * *', () => {
  const job = require(`${__hooks}/jobs/debt_reminders.js`)
  const now = new Date()
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

  job.remind($app, today)
})

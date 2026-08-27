// Every write to a repayment replays the debt it belongs to — see
// pb_hooks/jobs/debt_balance.js for why nothing is ever adjusted in place.
//
// These run *around* the write rather than after it succeeds, and for two
// reasons. A capital left wrong is worse than a repayment refused, so a replay
// that fails must take the write down with it — which only an in-transaction
// hook can do. And the split belongs to the response: the client that just
// recorded a payment is shown what it repaid, so the record is refreshed from
// the replay before the answer leaves.
//
// The split is zeroed on the way in. It depends on what was still owed when
// the payment landed, which the client cannot know and must not state.
onRecordCreate((e) => {
  e.record.set('principal_part', 0)
  e.record.set('interest_part', 0)

  e.next()

  const job = require(`${__hooks}/jobs/debt_balance.js`)

  job.recompute(e.app, e.record.get('debt'))
  job.refresh(e.app, e.record)
}, 'debt_payments')

onRecordUpdate((e) => {
  const previous = e.record.original().get('debt')

  e.next()

  const job = require(`${__hooks}/jobs/debt_balance.js`)

  job.recompute(e.app, e.record.get('debt'))

  // A repayment can be moved from one debt to another: the one it left has to
  // be replayed too, or it keeps a capital that was repaid elsewhere.
  if (previous !== e.record.get('debt')) {
    job.recompute(e.app, previous)
  }

  job.refresh(e.app, e.record)
}, 'debt_payments')

onRecordDelete((e) => {
  const debt = e.record.get('debt')

  e.next()

  require(`${__hooks}/jobs/debt_balance.js`).recompute(e.app, debt)
}, 'debt_payments')

// The terms are the other half of the replay. Changing a rate or the amount
// borrowed changes what every repayment repaid, and nothing recomputed it: the
// capital stayed stale until the next repayment happened to be written.
//
// The replay is authoritative rather than defensive: whatever the client
// stated for `remaining_amount` or `status` — measured accepted from a PATCH,
// which let a debt declare itself settled and silence its own reminders — is
// overwritten by what the history says. Restoring the previous value instead
// would undo the replay's own write and loop for ever; that was measured too.
onRecordUpdate((e) => {
  e.next()

  const job = require(`${__hooks}/jobs/debt_balance.js`)

  job.recompute(e.app, e.record.id)

  const replayed = e.app.findRecordById('debts', e.record.id)

  e.record.set('remaining_amount', replayed.getInt('remaining_amount'))
  e.record.set('status', replayed.get('status'))
}, 'debts')

// A new debt owes what was borrowed. Nothing has been repaid yet, so there is
// no history to replay and no figure for the client to state.
onRecordCreate((e) => {
  e.record.set('remaining_amount', e.record.getInt('initial_amount'))
  e.record.set('status', 'active')

  e.next()
}, 'debts')

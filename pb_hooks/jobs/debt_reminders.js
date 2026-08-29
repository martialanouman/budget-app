// DET-04 / NOT-01: an instalment is announced three days before, the day
// before, and on the day itself.
//
// Keyed by (due date, debt, offset) in the notification's `subject`, so the
// job can run every morning — and be re-run after an outage — without ringing
// twice for the same instalment. That is the only thing making a daily cron
// safe to retry.
//
// Both directions are announced. A date on which someone owes the user money
// is exactly when to ask for it (DET-02).
const OFFSETS = [3, 1, 0]

function remind(app, today) {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const debts = app.findRecordsByFilter('debts', "status = 'active'", '', 0, 0, {})
  const collection = app.findCollectionByNameOrId('notifications')

  for (let i = 0; i < debts.length; i++) {
    const debt = debts[i]
    const due = domain.nextDueDate(today, debt.getInt('due_day'))
    const offset = domain.daysUntil(today, due)

    if (OFFSETS.indexOf(offset) === -1) continue

    // The schedule on screen places the first instalment in the month after
    // the debt starts. Counting from the due day alone made a debt opened
    // today announce an instalment the app itself said was a month away — the
    // two readings of the same calendar contradicted each other.
    const firstDue = domain.instalmentDueDate(
      debt.get('start_date').string().substring(0, 10),
      debt.getInt('due_day'),
      0,
    )

    if (due < firstDue) continue

    const subject = `${due}@${debt.id}@${offset}`

    const already = app.findRecordsByFilter(
      'notifications',
      "user = {:user} && type = 'echeance_dette' && subject = {:subject}",
      '',
      1,
      0,
      { user: debt.get('user'), subject: subject },
    )

    if (already.length > 0) continue

    const reminder = new Record(collection)

    reminder.set('user', debt.get('user'))
    reminder.set('type', 'echeance_dette')
    reminder.set('subject', subject)
    reminder.set('due_at', due)
    reminder.set('payload', {
      debt: debt.id,
      creditor: debt.get('creditor'),
      direction: debt.get('direction'),
      dueDate: due,
      daysAhead: offset,
      amount: debt.getInt('monthly_payment'),
    })
    reminder.set('read', false)

    app.save(reminder)

    // The same instalment is announced three times. Once the nearer reminder
    // exists the earlier ones are stale — they still carry the day count they
    // were written with — so they stop asking to be read, and stay as history.
    for (let j = 0; j < OFFSETS.length; j++) {
      if (OFFSETS[j] <= offset) continue

      const stale = app.findRecordsByFilter(
        'notifications',
        "user = {:user} && type = 'echeance_dette' && subject = {:subject} && read = false",
        '',
        1,
        0,
        { user: debt.get('user'), subject: `${due}@${debt.id}@${OFFSETS[j]}` },
      )

      if (stale.length === 0) continue

      stale[0].set('read', true)
      app.save(stale[0])
    }
  }
}

module.exports = { remind: remind }

// BUD-04 / NOT-02, stated as a reconciliation rather than as a reaction.
//
// The first version only reacted to a creation, which left two holes: an
// expense corrected upwards never raised the threshold it had just crossed,
// and deleting the entry that tripped an alert left the warning on screen for
// good — the per-threshold deduplication forbidding it from ever being raised
// again.
//
// So the question asked here is never "what just happened" but "what should be
// on file for this envelope right now": the thresholds it has reached, no
// more. An alert the user has already dismissed is left alone — it is history.
function subjectOf(month, category) {
  return `${month}@${category}`
}

function reconcile(app, user, category, month) {
  if (!user || !category || !month) return

  const domain = require(`${__hooks}/lib/domain.cjs`)
  const scope = { user: user, category: category, month: month }
  const belongsToScope = 'user = {:user} && category = {:category} && month = {:month}'

  const budgets = app.findRecordsByFilter('budgets', belongsToScope, '', 1, 0, scope)
  const consumed = app.findRecordsByFilter('budget_spending', belongsToScope, '', 1, 0, scope)

  const cap =
    budgets.length === 0 ? 0 : budgets[0].getInt('cap_amount') + budgets[0].getInt('carried_amount')
  const spent = consumed.length === 0 ? 0 : consumed[0].getInt('spent')

  const reached = domain.reachedThresholds(cap, spent)
  const wanted = {}

  for (let i = 0; i < reached.length; i++) {
    wanted[String(reached[i])] = true
  }

  const subject = subjectOf(month, category)
  const existing = app.findRecordsByFilter(
    'notifications',
    "user = {:user} && type = 'depassement_budget' && subject = {:subject}",
    '',
    0,
    0,
    { user: user, subject: subject },
  )

  const onFile = {}

  for (let i = 0; i < existing.length; i++) {
    const alert = existing[i]
    const threshold = String(JSON.parse(String(alert.get('payload'))).threshold)

    if (wanted[threshold]) {
      onFile[threshold] = true

      continue
    }

    // No longer justified. A dismissed one stays: the user has seen it.
    if (!alert.getBool('read')) {
      app.delete(alert)
    }
  }

  const collection = app.findCollectionByNameOrId('notifications')

  for (let i = 0; i < reached.length; i++) {
    if (onFile[String(reached[i])]) continue

    const alert = new Record(collection)

    alert.set('user', user)
    alert.set('type', 'depassement_budget')
    alert.set('subject', subject)
    alert.set('payload', { month: month, category: category, threshold: reached[i] })
    alert.set('read', false)

    app.save(alert)
  }
}

module.exports = { reconcile: reconcile, subjectOf: subjectOf }

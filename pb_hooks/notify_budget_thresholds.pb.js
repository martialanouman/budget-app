// BUD-04 / NOT-02: an envelope reaching 80 % or 100 % of its cap owes the user
// one alert per threshold — not one per expense typed beyond it. The alert is
// keyed by (month, category, threshold) and written only if that key is not on
// file yet, which also makes a re-run harmless.
//
// Two properties this handler must keep:
//
//   - it runs after the entry is committed, and every failure inside it is
//     caught. An error thrown here comes back to the client as an HTTP 400 on
//     the entry itself — measured — so an alert that cannot be written must
//     never cost the user the expense they just typed;
//   - it asks for lists rather than single records, because "this category has
//     no envelope" is the ordinary case, not an error to catch.
//
// Everything lives inside the handler because PocketBase runs it as an
// isolated program — file-scope declarations are undefined here.
onRecordAfterCreateSuccess((e) => {
  try {
    const record = e.record

    if (record.get('type') !== 'depense' || !record.get('category')) {
      e.next()

      return
    }

    const domain = require(`${__hooks}/lib/domain.cjs`)
    const owner = record.get('user')
    const category = record.get('category')
    const month = record.get('date').string().substring(0, 7)
    const scope = { user: owner, category: category, month: month }
    const belongsToScope = 'user = {:user} && category = {:category} && month = {:month}'

    const budgets = e.app.findRecordsByFilter('budgets', belongsToScope, '', 1, 0, scope)

    if (budgets.length === 0) {
      e.next()

      return
    }

    const consumed = e.app.findRecordsByFilter('budget_spending', belongsToScope, '', 1, 0, scope)
    const spent = consumed.length === 0 ? 0 : consumed[0].getInt('spent')
    const cap = budgets[0].getInt('cap_amount') + budgets[0].getInt('carried_amount')

    const reached = domain.reachedThresholds(cap, spent)

    // Matched in JavaScript rather than in the filter: a condition on a JSON
    // path matched nothing here, so every later expense wrote the same alert
    // again. The set is small — a handful per month and per category.
    const sent = e.app.findRecordsByFilter(
      'notifications',
      "user = {:user} && type = 'depassement_budget'",
      '',
      0,
      0,
      { user: owner },
    )

    const already = {}

    for (let i = 0; i < sent.length; i++) {
      // A json field comes back as a raw value, not a plain object: reading
      // .month off it gives undefined, which silently defeated the dedupe.
      const payload = JSON.parse(String(sent[i].get('payload')))

      if (payload.month === month && payload.category === category) {
        already[String(payload.threshold)] = true
      }
    }

    const collection = e.app.findCollectionByNameOrId('notifications')

    for (let i = 0; i < reached.length; i++) {
      if (already[String(reached[i])]) continue

      const alert = new Record(collection)

      alert.set('user', owner)
      alert.set('type', 'depassement_budget')
      alert.set('payload', { month: month, category: category, threshold: reached[i] })
      alert.set('read', false)

      e.app.save(alert)
    }
  } catch (err) {
    e.app.logger().error('Budget threshold alert failed', 'error', String(err))
  }

  e.next()
}, 'transactions')

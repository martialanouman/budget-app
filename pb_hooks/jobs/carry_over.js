// BUD-06: an envelope marked `carry_over` bequeaths what it did not spend to
// the same category the following month. The figure is written into the next
// month's `carried_amount` rather than added to its cap: the user has to keep
// seeing the ceiling they chose, and an absolute value makes a second run
// harmless.
//
// Not a hook file — PocketBase only loads `*.pb.js` — but a module required by
// both the monthly cron and the hook that fires when an envelope is created
// after the month has already started. Without that second path, a budget
// duplicated on the 3rd would never receive the carry the cron applied on the
// 1st.
const PREVIOUS = (month) => {
  const parts = month.split('-')
  const year = Number(parts[0])
  const index = Number(parts[1])

  if (index === 1) return `${year - 1}-12`

  return `${year}-${index < 11 ? '0' : ''}${index - 1}`
}

/** What the previous month leaves to this category, or 0 when nothing does. */
function carriedInto(app, user, category, month) {
  const domain = require(`${__hooks}/lib/domain.cjs`)
  const previous = PREVIOUS(month)
  const scope = { user: user, category: category, month: previous }
  const belongsToScope = 'user = {:user} && category = {:category} && month = {:month}'

  const budgets = app.findRecordsByFilter(
    'budgets',
    `${belongsToScope} && carry_over = true`,
    '',
    1,
    0,
    scope,
  )

  if (budgets.length === 0) return 0

  const consumed = app.findRecordsByFilter('budget_spending', belongsToScope, '', 1, 0, scope)
  const spent = consumed.length === 0 ? 0 : consumed[0].getInt('spent')
  const cap = budgets[0].getInt('cap_amount') + budgets[0].getInt('carried_amount')

  return domain.unspent(cap, spent)
}

/** Fills every envelope of `month` with what the month before leaves it. */
function applyCarryOver(app, month) {
  const budgets = app.findRecordsByFilter('budgets', 'month = {:month}', '', 0, 0, { month: month })

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i]
    const carried = carriedInto(app, budget.get('user'), budget.get('category'), month)

    if (carried === budget.getInt('carried_amount')) continue

    budget.set('carried_amount', carried)
    app.save(budget)
  }
}

module.exports = {
  carriedInto: carriedInto,
  applyCarryOver: applyCarryOver,
  previousMonth: PREVIOUS,
}

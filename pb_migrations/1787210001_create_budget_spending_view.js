// BUD-03 reads spending per category and per month. Summing it in SQLite keeps
// the rule of the project: cumulative figures are computed on read, never
// stored, so they cannot drift from the entries behind them.
//
// The month is cut out of the stored timestamp with substr rather than
// strftime: dates are kept as `YYYY-MM-DD HH:MM:SS.SSSZ`, whose trailing Z is
// not a format SQLite's date functions accept. The first seven characters are
// the month, exactly.
//
// Only `depense` counts. Transfers move money between the owner's own accounts
// and would inflate every envelope they touched (CPT-05).
const SPENT_BY_CATEGORY = `
  SELECT
    (transactions.user || '@' || transactions.category || '@' || substr(transactions.date, 1, 7)) AS id,
    transactions.user AS user,
    transactions.category AS category,
    substr(transactions.date, 1, 7) AS month,
    SUM(transactions.amount) AS spent
  FROM transactions
  WHERE transactions.type = 'depense' AND transactions.category != ''
  GROUP BY transactions.user, transactions.category, substr(transactions.date, 1, 7)
`

migrate(
  (app) => {
    const view = new Collection({
      type: 'view',
      name: 'budget_spending',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      viewQuery: SPENT_BY_CATEGORY,
    })

    app.save(view)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('budget_spending'))
  },
)

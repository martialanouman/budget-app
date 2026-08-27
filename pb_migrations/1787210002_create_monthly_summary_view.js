// BUD-05 needs the month's income and its total spending as two numbers, at
// the grain of the user and the month — a grain the per-category view cannot
// answer without shipping every row to the client.
//
// CAST is not decoration: PocketBase cannot infer the type of an aggregate,
// and an uncast SUM comes back as a JSON value that reads as zero from the
// hooks (measured on budget_spending).
//
// Transfers are left out on both sides: they move money between the owner's
// own accounts and are neither income nor spending (CPT-05).
const MONTHLY_TOTALS = `
  SELECT
    (transactions.user || '@' || substr(transactions.date, 1, 7)) AS id,
    transactions.user AS user,
    substr(transactions.date, 1, 7) AS month,
    CAST(SUM(CASE WHEN transactions.type = 'revenu' THEN transactions.amount ELSE 0 END) AS INT) AS income,
    CAST(SUM(CASE WHEN transactions.type = 'depense' THEN transactions.amount ELSE 0 END) AS INT) AS spent
  FROM transactions
  GROUP BY transactions.user, substr(transactions.date, 1, 7)
`

migrate(
  (app) => {
    const view = new Collection({
      type: 'view',
      name: 'monthly_summary',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      viewQuery: MONTHLY_TOTALS,
    })

    app.save(view)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('monthly_summary'))
  },
)

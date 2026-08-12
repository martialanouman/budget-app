// Step 3 shipped this view returning only the initial balance, because
// `transactions` did not exist yet. Now it sums them: the balance stays
// computed on read and can never drift from the entries behind it.
//
// The opening balance is folded in as just another movement, through a
// UNION ALL. That is not stylistic: PocketBase's view parser rejects an
// addition between two expressions in the SELECT list — measured with
// dry-run-view, `COALESCE(a,0) + COALESCE(SUM(b),0)` is refused while either
// half alone is accepted. One UNION, one SUM, no addition.
//
// Amounts are stored positive, so the direction comes from `type`.
const WITH_TRANSACTIONS = `
  SELECT
    movements.account_id AS id,
    movements.owner AS user,
    COALESCE(SUM(movements.delta), 0) AS balance
  FROM (
    SELECT accounts.id AS account_id, accounts.user AS owner,
           COALESCE(accounts.initial_balance, 0) AS delta
    FROM accounts
    UNION ALL
    SELECT transactions.account, transactions.user,
           CASE WHEN transactions.type = 'revenu' THEN transactions.amount
                ELSE -transactions.amount END
    FROM transactions
  ) movements
  GROUP BY movements.account_id, movements.owner
`

const INITIAL_ONLY = `
  SELECT
    accounts.id AS id,
    accounts.user AS user,
    COALESCE(accounts.initial_balance, 0) AS balance
  FROM accounts
`

migrate(
  (app) => {
    const view = app.findCollectionByNameOrId('account_balances')

    view.viewQuery = WITH_TRANSACTIONS

    app.save(view)
  },
  (app) => {
    const view = app.findCollectionByNameOrId('account_balances')

    view.viewQuery = INITIAL_ONLY

    app.save(view)
  },
)

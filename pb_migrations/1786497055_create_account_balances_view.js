// Balances are computed on read rather than stored, so they can never drift
// from the transactions that make them up. A view collection runs the SUM in
// SQLite instead of shipping the history to the client.
//
// Only the initial balance for now: `transactions` arrives in step 4, which
// replaces this query with the full sum. View collections are read-only and
// emit no realtime events, so freshness comes from invalidating the query
// cache after a mutation.
migrate(
  (app) => {
    const view = new Collection({
      type: 'view',
      name: 'account_balances',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      viewQuery: `
        SELECT
          accounts.id AS id,
          accounts.user AS user,
          COALESCE(accounts.initial_balance, 0) AS balance
        FROM accounts
      `,
    })

    app.save(view)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('account_balances'))
  },
)

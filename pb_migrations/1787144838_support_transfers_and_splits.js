// A transfer is two rows, one leaving an account and one entering another.
// The specs name a single `virement` type, but the balance view needs to know
// the direction to pick a sign. Two explicit values keep that decision in the
// data instead of in a second conditional field: the view lists which types
// add and which subtract, and any spend aggregate excludes both by prefix.
//
// A split is several ordinary rows sharing `split_group`. Each counts once
// everywhere — balances, budgets, reports — so there is one rule, not two.
const TYPES = ['depense', 'revenu', 'virement_sortant', 'virement_entrant']

const WITH_TRANSFERS = `
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
           CASE WHEN transactions.type IN ('revenu', 'virement_entrant')
                THEN transactions.amount
                ELSE -transactions.amount END
    FROM transactions
  ) movements
  GROUP BY movements.account_id, movements.owner
`

const WITHOUT_TRANSFERS = `
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

migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.fields.getByName('type').values = TYPES
    transactions.fields.add(new TextField({ name: 'transfer_group', max: 40 }))
    transactions.fields.add(new TextField({ name: 'split_group', max: 40 }))

    app.save(transactions)

    const view = app.findCollectionByNameOrId('account_balances')

    view.viewQuery = WITH_TRANSFERS

    app.save(view)
  },
  (app) => {
    const view = app.findCollectionByNameOrId('account_balances')

    view.viewQuery = WITHOUT_TRANSFERS

    app.save(view)

    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.fields.removeByName('transfer_group')
    transactions.fields.removeByName('split_group')
    transactions.fields.getByName('type').values = ['depense', 'revenu']

    app.save(transactions)
  },
)

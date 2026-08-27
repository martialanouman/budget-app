// A leg of a transfer is not an ordinary transaction: editing one alone breaks
// the pair the route was written to guarantee. A PATCH flipping a
// `virement_sortant` to `revenu` turned a 30 000 F debit into a 30 000 F
// credit, inventing 60 000 F. Legs are deleted as a pair (see
// pb_hooks/keep_transfer_pairs.pb.js) and are not editable at all.
const OWNER_ONLY = 'user = @request.auth.id'

const OWNED_ACCOUNT_AND_CATEGORY = `${OWNER_ONLY} && account.user = @request.auth.id && (category = '' || category.user = @request.auth.id)`

migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.updateRule = `${OWNED_ACCOUNT_AND_CATEGORY} && transfer_group = ''`

    app.save(transactions)
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.updateRule = OWNED_ACCOUNT_AND_CATEGORY

    app.save(transactions)
  },
)

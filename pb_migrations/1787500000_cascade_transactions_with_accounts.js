// USR-04. Closing an account failed with HTTP 400, "Failed to delete record",
// and it was `transactions.account` that held it: the field is required and did
// not cascade, so deleting an owner swept their accounts away while the entries
// still pointed at them, and PocketBase refused the whole operation. Measured
// on 19/08/2026; an account with any history at all could not be closed.
//
// Cascading is safe here precisely because `accounts.deleteRule` is null: a user
// can never delete an account directly — accounts are archived, not deleted —
// so the only thing that removes one is the owner's own cascade, which is
// exactly when the entries should go too.
//
// The pattern this exposes is worth keeping in mind: a non-cascading relation
// that is OPTIONAL gets blanked on delete (`transactions.category` becomes ''),
// while a REQUIRED one blocks. Only the required ones stand in the way.
migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.fields.getByName('account').cascadeDelete = true

    app.save(transactions)
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.fields.getByName('account').cascadeDelete = false

    app.save(transactions)
  },
)

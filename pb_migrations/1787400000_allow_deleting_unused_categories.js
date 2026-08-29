// CAT-02 deactivates rather than deletes, so past transactions stay attachable.
// A category nothing points at has no such history to protect, and staying on
// screen for ever is the only thing deactivation buys it.
//
// The "nothing points at it" condition is deliberately NOT written into the
// rule. PocketBase can express back-relations in a filter, but negating a
// multi-match correctly is subtle, and getting it wrong here deletes envelopes.
// The check lives in pb_hooks/guard_category_deletion.pb.js, which can also say
// what is holding the category.
const USAGE_PER_CATEGORY = `
  SELECT
    categories.id AS id,
    categories.user AS user,
    CAST((SELECT COUNT(*) FROM transactions WHERE transactions.category = categories.id) AS INT) AS transaction_count,
    CAST((SELECT COUNT(*) FROM budgets WHERE budgets.category = categories.id) AS INT) AS budget_count,
    CAST((SELECT COUNT(*) FROM categories AS child WHERE child.parent = categories.id) AS INT) AS child_count
  FROM categories
`

migrate(
  (app) => {
    const categories = app.findCollectionByNameOrId('categories')

    categories.deleteRule = 'user = @request.auth.id'
    app.save(categories)

    // Counted in SQLite, like every other cumulative figure here: the screen
    // needs one row per category, not the thousands of entries behind them.
    // The CASTs are not cosmetic — an untyped aggregate comes back as a JSON
    // value that getInt() reads as 0 (measured at step 5).
    const usage = new Collection({
      type: 'view',
      name: 'category_usage',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      viewQuery: USAGE_PER_CATEGORY,
    })

    app.save(usage)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('category_usage'))

    const categories = app.findCollectionByNameOrId('categories')
    categories.deleteRule = null
    app.save(categories)
  },
)

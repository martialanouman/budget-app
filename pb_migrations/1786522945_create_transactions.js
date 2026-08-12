// Amounts are always positive; `type` carries the direction. Storing a signed
// figure would let a "dépense" of -5000 mean an income, and every aggregate
// would have to guard against it.
//
// Unlike accounts and categories, a transaction can be deleted (TRX-05): a
// mistyped entry has no history worth keeping, and leaving it would corrupt
// every balance it touches.
const OWNER_ONLY = 'user = @request.auth.id'

const OWNED_ACCOUNT_AND_CATEGORY = `${OWNER_ONLY} && account.user = @request.auth.id && (category = '' || category.user = @request.auth.id)`

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id
    const accountsId = app.findCollectionByNameOrId('accounts').id
    const categoriesId = app.findCollectionByNameOrId('categories').id

    const transactions = new Collection({
      type: 'base',
      name: 'transactions',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      createRule: OWNED_ACCOUNT_AND_CATEGORY,
      updateRule: OWNED_ACCOUNT_AND_CATEGORY,
      deleteRule: OWNER_ONLY,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'account',
          type: 'relation',
          required: true,
          collectionId: accountsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        // Optional: transfers carry no category (step 4b).
        {
          name: 'category',
          type: 'relation',
          required: false,
          collectionId: categoriesId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['depense', 'revenu'],
        },
        { name: 'amount', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'date', type: 'date', required: true },
        { name: 'note', type: 'text', max: 200 },
      ],
      // The two lookups every balance and budget aggregate performs.
      indexes: [
        'CREATE INDEX idx_transactions_user_account_date ON transactions (user, account, date)',
        'CREATE INDEX idx_transactions_user_category_date ON transactions (user, category, date)',
      ],
    })

    app.save(transactions)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('transactions'))
  },
)

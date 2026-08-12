// Accounts and categories are the two reference tables every later step reads
// from. Both are scoped to their owner by the same rule, and both keep their
// history: an account is archived, a category deactivated, never deleted.
const OWNER_ONLY = 'user = @request.auth.id'

// A category may only hang off one of its owner's categories. Without this a
// record can point at a stranger's parent: it is then neither a root nor any
// visible root's child, so it renders nowhere and cannot be deactivated.
const OWNER_ONLY_WITH_OWNED_PARENT = `${OWNER_ONLY} && (parent = '' || parent.user = @request.auth.id)`

const ACCOUNT_TYPES = ['banque', 'mobile_money', 'especes', 'epargne', 'autre']
const CATEGORY_KINDS = ['fixe', 'variable']

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id

    const owner = {
      name: 'user',
      type: 'relation',
      required: true,
      collectionId: usersId,
      maxSelect: 1,
      cascadeDelete: true,
    }

    const accounts = new Collection({
      type: 'base',
      name: 'accounts',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      createRule: OWNER_ONLY,
      updateRule: OWNER_ONLY,
      // Deletion is closed to everyone: accounts are archived, never removed,
      // so their transaction history stays attachable.
      deleteRule: null,
      fields: [
        owner,
        { name: 'name', type: 'text', required: true, max: 60 },
        { name: 'type', type: 'select', required: true, maxSelect: 1, values: ACCOUNT_TYPES },
        // onlyInt keeps the XOF invariant at the storage layer, not just in
        // the domain: the franc has no subunit.
        { name: 'initial_balance', type: 'number', required: false, onlyInt: true },
        { name: 'color', type: 'text', max: 20 },
        { name: 'archived', type: 'bool' },
      ],
      indexes: [
        'CREATE INDEX idx_accounts_user ON accounts (user)',
        'CREATE INDEX idx_accounts_user_archived ON accounts (user, archived)',
      ],
    })

    app.save(accounts)

    const categories = new Collection({
      type: 'base',
      name: 'categories',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      // Parent rules are applied once the self-relation exists, below.
      createRule: OWNER_ONLY,
      updateRule: OWNER_ONLY,
      deleteRule: null,
      fields: [
        owner,
        { name: 'name', type: 'text', required: true, max: 60 },
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: CATEGORY_KINDS },
        { name: 'active', type: 'bool' },
      ],
      indexes: [
        'CREATE INDEX idx_categories_user ON categories (user)',
        'CREATE INDEX idx_categories_user_active ON categories (user, active)',
      ],
    })

    app.save(categories)

    // Self-relation added after the first save, since the collection must
    // exist before it can reference itself.
    categories.fields.add(
      new RelationField({
        name: 'parent',
        required: false,
        collectionId: categories.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )

    categories.createRule = OWNER_ONLY_WITH_OWNED_PARENT
    categories.updateRule = OWNER_ONLY_WITH_OWNED_PARENT

    app.save(categories)
  },
  (app) => {
    for (const name of ['categories', 'accounts']) {
      app.delete(app.findCollectionByNameOrId(name))
    }
  },
)

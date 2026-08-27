// BUD-01: an envelope per category and per month. The month is calendar and
// not configurable in v1, so a `YYYY-MM` text is both the key and the whole
// truth about the period — no range to intersect, no timezone to pick.
//
// `carried_amount` is stored beside `cap_amount` rather than folded into it
// (BUD-06): the user has to keep seeing the ceiling they chose, and an
// absolute figure lets the monthly job run twice without doubling the carry.
const OWNER_ONLY = 'user = @request.auth.id'

const OWNED_CATEGORY = `${OWNER_ONLY} && category.user = @request.auth.id`

const NOTIFICATION_TYPES = ['echeance_dette', 'recurrente', 'depassement_budget', 'rappel_saisie']

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id
    const categoriesId = app.findCollectionByNameOrId('categories').id

    const owner = {
      name: 'user',
      type: 'relation',
      required: true,
      collectionId: usersId,
      maxSelect: 1,
      cascadeDelete: true,
    }

    const budgets = new Collection({
      type: 'base',
      name: 'budgets',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      createRule: OWNED_CATEGORY,
      updateRule: OWNED_CATEGORY,
      deleteRule: OWNER_ONLY,
      fields: [
        owner,
        {
          name: 'month',
          type: 'text',
          required: true,
          max: 7,
          pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
        },
        {
          name: 'category',
          type: 'relation',
          required: true,
          collectionId: categoriesId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'cap_amount', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'carry_over', type: 'bool' },
        // Filled by the monthly job from the previous month's leftover; the
        // effective ceiling is cap_amount + carried_amount.
        { name: 'carried_amount', type: 'number', onlyInt: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      // One envelope per category and month: a second would split the cap in
      // two and every total would silently disagree with the screen.
      indexes: [
        'CREATE UNIQUE INDEX idx_budgets_user_month_category ON budgets (user, month, category)',
      ],
    })

    app.save(budgets)

    const notifications = new Collection({
      type: 'base',
      name: 'notifications',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      // Written by hooks and crons only; the client may mark one as read and
      // dismiss it, never invent one.
      createRule: null,
      updateRule: OWNER_ONLY,
      deleteRule: OWNER_ONLY,
      fields: [
        owner,
        { name: 'type', type: 'select', required: true, maxSelect: 1, values: NOTIFICATION_TYPES },
        { name: 'payload', type: 'json', maxSize: 2000 },
        { name: 'due_at', type: 'date' },
        { name: 'read', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_notifications_user_read ON notifications (user, read)'],
    })

    app.save(notifications)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('notifications'))
    app.delete(app.findCollectionByNameOrId('budgets'))
  },
)

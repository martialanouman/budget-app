// DET-01 à DET-03. Two collections: the debt and its repayments.
//
// `remaining_amount` is stored, against the project's rule that cumulative
// figures are computed on read. The exception is deliberate and bounded: the
// list sorts on it, the dashboard sums it, and the `soldee` transition hangs
// off it. What keeps it honest is that it is never adjusted — every write
// replays the whole payment history (pb_hooks/jobs/debt_balance.js), so it
// cannot drift the way an incremented figure does.
//
// `interest_rate` is the one number here that may carry decimals. A rate is
// not an amount: 7.5 % is ordinary, and every franc it produces is rounded to
// a whole one before it is stored or shown.
const OWNER_ONLY = 'user = @request.auth.id'

const OWNED_DEBT = `${OWNER_ONLY} && debt.user = @request.auth.id`

const DEBT_KINDS = ['pret_bancaire', 'credit_conso', 'familiale', 'tontine', 'decouvert', 'autre']
const DIRECTIONS = ['je_dois', 'on_me_doit']
const STATUSES = ['active', 'soldee']

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id
    const transactionsId = app.findCollectionByNameOrId('transactions').id

    const owner = {
      name: 'user',
      type: 'relation',
      required: true,
      collectionId: usersId,
      maxSelect: 1,
      cascadeDelete: true,
    }

    const debts = new Collection({
      type: 'base',
      name: 'debts',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      createRule: OWNER_ONLY,
      updateRule: OWNER_ONLY,
      deleteRule: OWNER_ONLY,
      fields: [
        owner,
        { name: 'creditor', type: 'text', required: true, max: 80 },
        { name: 'kind', type: 'select', required: true, maxSelect: 1, values: DEBT_KINDS },
        // DET-02: the module also tracks what is owed to the user.
        { name: 'direction', type: 'select', required: true, maxSelect: 1, values: DIRECTIONS },
        { name: 'initial_amount', type: 'number', required: true, onlyInt: true, min: 1 },
        // Written by the server only, always replayed from the payments.
        { name: 'remaining_amount', type: 'number', onlyInt: true, min: 0 },
        { name: 'interest_rate', type: 'number', required: false, min: 0, max: 100 },
        { name: 'monthly_payment', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'due_day', type: 'number', required: true, onlyInt: true, min: 1, max: 31 },
        { name: 'start_date', type: 'date', required: true },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: STATUSES },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_debts_user_status ON debts (user, status)'],
    })

    app.save(debts)

    const payments = new Collection({
      type: 'base',
      name: 'debt_payments',
      listRule: OWNER_ONLY,
      viewRule: OWNER_ONLY,
      createRule: OWNED_DEBT,
      updateRule: OWNED_DEBT,
      deleteRule: OWNER_ONLY,
      fields: [
        owner,
        {
          name: 'debt',
          type: 'relation',
          required: true,
          collectionId: debts.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        // DET-03: a repayment may be the same event as a transaction already
        // typed. Deleting the debt must not take that transaction with it.
        {
          name: 'transaction',
          type: 'relation',
          required: false,
          collectionId: transactionsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'amount', type: 'number', required: true, onlyInt: true, min: 1 },
        // The split is the server's to state: it depends on what was still
        // owed when this payment landed, which the client cannot know.
        { name: 'principal_part', type: 'number', onlyInt: true, min: 0 },
        { name: 'interest_part', type: 'number', onlyInt: true, min: 0 },
        { name: 'date', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      // The replay reads a debt's payments in the order they were made.
      indexes: ['CREATE INDEX idx_debt_payments_debt_date ON debt_payments (debt, date)'],
    })

    app.save(payments)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('debt_payments'))
    app.delete(app.findCollectionByNameOrId('debts'))
  },
)

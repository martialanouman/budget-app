// TRX-08: one purchase spread over several categories, stored as ordinary
// rows sharing a split_group. Each counts once in balances, budgets and
// reports — one rule rather than two opposing ones.
//
// Atomic for the same reason as transfers: a half-written split shows a total
// that never matches what was spent. Everything sits inside the handler,
// which PocketBase runs as an isolated program.
routerAdd(
  'POST',
  '/api/splits',
  (e) => {
    const domain = require(`${__hooks}/lib/domain.cjs`)
    const body = e.requestInfo().body
    const owner = e.auth.id
    const parts = body.parts

    // Measured before the length: a plain object has no length, slipped past
    // the check and only failed later, deep inside the loop.
    if (!parts || typeof parts !== 'object' || typeof parts.length !== 'number') {
      throw new BadRequestError('A split needs a list of parts.')
    }

    if (parts.length < 2) {
      throw new BadRequestError('A split needs at least two parts.')
    }

    // Each part is one row written inside a single transaction; nothing else
    // bounds how many a client may ask for.
    if (parts.length > 50) {
      throw new BadRequestError('A split cannot hold more than 50 parts.')
    }

    if (!body.account || !body.date) {
      throw new BadRequestError('A split needs an account and a date.')
    }

    // An unhandled lookup answered 404 on a POST, which reads as "no such
    // route"; and one message for both cases keeps an unknown id from being
    // distinguishable from someone else's.
    const owned = (collection, id, message) => {
      let record

      try {
        record = e.app.findRecordById(collection, id)
      } catch {
        throw new BadRequestError(message)
      }

      if (record.get('user') !== owner) {
        throw new BadRequestError(message)
      }

      return record
    }

    owned('accounts', body.account, 'The account must belong to you.')

    const amounts = []

    for (const part of parts) {
      let amount
      try {
        amount = domain.toMoney(part.amount)
      } catch (err) {
        throw new BadRequestError(`Invalid amount: ${String(err)}`)
      }

      if (amount <= 0) {
        throw new BadRequestError('Every part of a split must be positive.')
      }

      if (!part.category) {
        throw new BadRequestError('Every part of a split needs a category.')
      }

      owned('categories', part.category, 'Every category must belong to you.')

      amounts.push({ category: part.category, amount })
    }

    const group = $security.randomString(15)
    const collection = e.app.findCollectionByNameOrId('transactions')

    e.app.runInTransaction((txApp) => {
      for (const part of amounts) {
        const row = new Record(collection)

        row.set('user', owner)
        row.set('account', body.account)
        row.set('category', part.category)
        row.set('type', 'depense')
        row.set('amount', part.amount)
        row.set('date', body.date)
        row.set('note', body.note || '')
        row.set('split_group', group)

        txApp.save(row)
      }
    })

    return e.json(200, { split_group: group })
  },
  $apis.requireAuth(),
)

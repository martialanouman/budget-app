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
    const parts = body.parts || []

    if (parts.length < 2) {
      throw new BadRequestError('A split needs at least two parts.')
    }

    if (!body.account || !body.date) {
      throw new BadRequestError('A split needs an account and a date.')
    }

    const account = e.app.findRecordById('accounts', body.account)

    if (account.get('user') !== owner) {
      throw new BadRequestError('The account must belong to you.')
    }

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

      const category = e.app.findRecordById('categories', part.category)

      if (category.get('user') !== owner) {
        throw new BadRequestError('Every category must belong to you.')
      }

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

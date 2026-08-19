// CPT-05: a transfer is one operation that must leave two rows or none.
// Written as a server route rather than two client writes: a connection lost
// between a debit and its credit would otherwise destroy money, with nothing
// to reconcile it.
//
// Everything lives inside the handler because PocketBase serialises it and
// runs it as an isolated program — file-scope declarations are undefined here.
routerAdd(
  'POST',
  '/api/transfers',
  (e) => {
    const domain = require(`${__hooks}/lib/domain.cjs`)
    const body = e.requestInfo().body
    const owner = e.auth.id

    let amount
    try {
      amount = domain.toMoney(body.amount)
    } catch (err) {
      throw new BadRequestError(`Invalid amount: ${String(err)}`)
    }

    if (amount <= 0) {
      throw new BadRequestError('A transfer amount must be positive.')
    }

    if (!body.from || !body.to || body.from === body.to) {
      throw new BadRequestError('A transfer needs two distinct accounts.')
    }

    if (!body.date) {
      throw new BadRequestError('A transfer needs a date.')
    }

    const source = e.app.findRecordById('accounts', body.from)
    const destination = e.app.findRecordById('accounts', body.to)

    if (source.get('user') !== owner || destination.get('user') !== owner) {
      throw new BadRequestError('Both accounts must belong to you.')
    }

    const group = $security.randomString(15)
    const collection = e.app.findCollectionByNameOrId('transactions')

    e.app.runInTransaction((txApp) => {
      const legs = [
        { account: body.from, type: 'virement_sortant' },
        { account: body.to, type: 'virement_entrant' },
      ]

      for (const leg of legs) {
        const row = new Record(collection)

        row.set('user', owner)
        row.set('account', leg.account)
        row.set('category', '')
        row.set('type', leg.type)
        row.set('amount', amount)
        row.set('date', body.date)
        row.set('note', body.note || '')
        row.set('transfer_group', group)

        txApp.save(row)
      }
    })

    return e.json(200, { transfer_group: group })
  },
  $apis.requireAuth(),
)

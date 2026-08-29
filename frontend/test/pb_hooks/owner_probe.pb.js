// Counting what is left of a closed account has to see past the access rules.
// They hide another owner's rows whether or not those rows still exist, so a
// test that merely asks as somebody else proves nothing at all.
//
// Harness only — the file never leaves this directory.
routerAdd(
  'POST',
  '/api/test/owner-rows',
  (e) => {
    const owner = e.requestInfo().body.user
    const collections = [
      'accounts',
      'categories',
      'transactions',
      'budgets',
      'debts',
      'debt_payments',
      'notifications',
    ]

    const counts = {}

    for (let i = 0; i < collections.length; i++) {
      counts[collections[i]] = e.app.findRecordsByFilter(
        collections[i],
        'user = {:user}',
        '',
        0,
        0,
        { user: owner },
      ).length
    }

    return e.json(200, counts)
  },
  $apis.requireAuth(),
)

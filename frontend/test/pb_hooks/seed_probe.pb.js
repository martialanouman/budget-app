// Seeding three years of entries through the API would take minutes and fire
// every hook thousands of times. This writes them straight to SQLite in one
// transaction: the point is to measure reading, not writing.
//
// Harness only — the file never leaves this directory.
routerAdd(
  'POST',
  '/api/test/seed-transactions',
  (e) => {
    const body = e.requestInfo().body
    const owner = e.auth.id
    const count = body.count
    const categories = e.app.findRecordsByFilter('categories', 'user = {:user}', '', 0, 0, {
      user: owner,
    })

    e.app.runInTransaction((txApp) => {
      for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length].id
        // Spread over three years, so the month views have to group rather
        // than scan one bucket.
        const day = (i % 28) + 1
        const month = (i % 12) + 1
        const year = 2024 + Math.floor(i / 1800)
        const date = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day} 12:00:00.000Z`

        txApp
          .db()
          .newQuery(
            'INSERT INTO transactions (id, user, account, category, type, amount, date, note, transfer_group, split_group, created, updated)' +
              ' VALUES ({:id}, {:user}, {:account}, {:category}, {:type}, {:amount}, {:date}, {:note}, {:group}, {:split}, {:created}, {:created})',
          )
          .bind({
            id: $security.randomString(15),
            user: owner,
            account: body.account,
            category: category,
            type: i % 7 === 0 ? 'revenu' : 'depense',
            amount: 1000 + (i % 50) * 100,
            date: date,
            note: '',
            group: '',
            split: '',
            created: date,
          })
          .execute()
      }
    })

    return e.json(200, { seeded: count })
  },
  $apis.requireAuth(),
)

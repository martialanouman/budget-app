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

    // Returned to the caller so the load test can wait on a figure it knows,
    // rather than on a category name that happened to reach the top five.
    let net = 0

    e.app.runInTransaction((txApp) => {
      for (let i = 0; i < count; i++) {
        // One entry per category, then on to the next month: every category
        // therefore has expenses in every month, whatever the default set
        // holds. Cycling the month on `i % 12` beside the category on
        // `i % categories.length` left that property resting on eleven and
        // twelve being coprime — a twelfth default category would have broken
        // a load test for a reason nobody would have found.
        const slot = i % categories.length
        const block = Math.floor(i / categories.length)
        const category = categories[slot].id
        // Spread over three years, so the month views have to group rather
        // than scan one bucket.
        const day = (i % 28) + 1
        const month = (block % 12) + 1
        const year = 2024 + Math.floor(i / 1800)
        const date = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day} 12:00:00.000Z`
        const income = slot === categories.length - 1 && block % 8 === 0
        const amount = 1000 + (i % 50) * 100

        net += income ? amount : -amount

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
            // Income rides on its own slot rather than on a third cycle, for
            // the same reason: no month may end up without expenses.
            type: income ? 'revenu' : 'depense',
            amount: amount,
            date: date,
            note: '',
            group: '',
            split: '',
            created: date,
          })
          .execute()
      }
    })

    return e.json(200, { seeded: count, net: net })
  },
  $apis.requireAuth(),
)

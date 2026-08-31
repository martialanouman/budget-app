// A page boundary needs more entries than a page holds, and the properties
// under test need them to share an instant: `date` and `created` identical
// across the lot, which is when an ORDER BY has ties and offset paging can
// skip or repeat rows. Creating them through the API would fire every hook
// dozens of times for a fixture, so this writes them in one transaction.
//
// Harness only — the file never leaves this directory.
routerAdd(
  'POST',
  '/api/test/seed-day',
  (e) => {
    const body = e.requestInfo().body
    const stamp = `${body.date} 12:00:00.000Z`

    e.app.runInTransaction((txApp) => {
      for (let i = 0; i < body.count; i++) {
        txApp
          .db()
          .newQuery(
            'INSERT INTO transactions (id, user, account, category, type, amount, date, note, transfer_group, split_group, created, updated)' +
              " VALUES ({:id}, {:user}, {:account}, {:category}, 'depense', {:amount}, {:stamp}, {:note}, '', '', {:stamp}, {:stamp})",
          )
          .bind({
            id: $security.randomString(15),
            user: e.auth.id,
            account: body.account,
            category: body.category,
            amount: body.amount,
            stamp: stamp,
            note: `${body.note || 'Ligne'} ${i + 1}`,
          })
          .execute()
      }
    })

    return e.json(200, { seeded: body.count, date: body.date })
  },
  $apis.requireAuth(),
)

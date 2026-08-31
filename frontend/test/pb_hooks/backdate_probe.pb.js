// The thirty-day window is read from the real clock inside a hook, so no test
// can move the deadline towards the entry. It has to move the entry instead.
//
// This writes `created` straight to SQLite: the field is autodate with
// onUpdate: false, so the API refuses to set it, and going through the record
// API would fire the very guard under test.
//
// Harness only — the file never leaves this directory.
routerAdd(
  'POST',
  '/api/test/backdate-transaction',
  (e) => {
    const body = e.requestInfo().body

    e.app
      .db()
      .newQuery('UPDATE transactions SET created = {:created} WHERE id = {:id} AND user = {:user}')
      .bind({ id: body.id, created: body.created, user: e.auth.id })
      .execute()

    return e.json(200, { backdated: body.id, created: body.created })
  },
  $apis.requireAuth(),
)

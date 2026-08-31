// USR-04. Everything the owner put in, in one document they can keep.
routerAdd(
  'GET',
  '/api/export',
  (e) => {
    const OWNED = [
      'accounts',
      'categories',
      'transactions',
      'budgets',
      'debts',
      'debt_payments',
      'notifications',
    ]

    // The identity comes from the session and from nowhere else. This route
    // reads past the access rules by construction — it has to, to gather rows
    // from seven collections — so a caller-supplied id would hand any owner
    // anybody else's entire financial history.
    const owner = e.auth.id

    // The account is built field by field rather than serialised wholesale. A
    // dump of "everything about me" is the easiest place in an application to
    // leak a credential, and an allow-list cannot leak a field that is added
    // to the collection later.
    const data = {
      exported_at: new Date().toISOString(),
      account: {
        id: e.auth.id,
        email: e.auth.get('email'),
        name: e.auth.get('name'),
        verified: e.auth.get('verified'),
        settings: e.auth.get('settings'),
        created: String(e.auth.get('created')),
        updated: String(e.auth.get('updated')),
      },
    }

    for (let i = 0; i < OWNED.length; i++) {
      // Sorted by id, not by `created`: that field is not implicit since
      // PocketBase 0.23 and only some of these collections declare it —
      // sorting on it fails outright with `invalid sort field`. An id is always
      // there, and gives an export that is at least stable between runs.
      const rows = e.app.findRecordsByFilter(OWNED[i], 'user = {:user}', 'id', 0, 0, {
        user: owner,
      })

      const exported = []

      for (let j = 0; j < rows.length; j++) {
        exported.push(rows[j].publicExport())
      }

      data[OWNED[i]] = exported
    }

    return e.json(200, data)
  },
  $apis.requireAuth(),
)

// CAT-01: a new account starts with a usable set of categories, without the
// user having to create any. Names are user-facing, hence French; the
// fixe/variable split feeds the reports (CAT-03).
//
// The list lives inside the handler on purpose: PocketBase serialises each
// handler and runs it as an isolated program, so anything declared at file
// scope is undefined by the time this executes.
onRecordAfterCreateSuccess((e) => {
  const defaults = [
    ['Logement', 'fixe'],
    ['Abonnements', 'fixe'],
    ['Éducation', 'fixe'],
    ['Dettes', 'fixe'],
    ['Épargne', 'fixe'],
    ['Alimentation', 'variable'],
    ['Transport', 'variable'],
    ['Santé', 'variable'],
    ['Famille', 'variable'],
    ['Loisirs', 'variable'],
    ['Autre', 'variable'],
  ]

  // The user row is already committed by the time this runs, so a seeding
  // failure must not surface as a failed sign-up: the caller would retry and
  // hit "email already in use", locked out of an account that exists.
  try {
    const categories = e.app.findCollectionByNameOrId('categories')

    for (const [name, kind] of defaults) {
      const category = new Record(categories)

      category.set('user', e.record.id)
      category.set('name', name)
      category.set('kind', kind)
      category.set('active', true)

      e.app.save(category)
    }
  } catch (err) {
    console.warn(`Could not seed default categories for ${e.record.id}: ${String(err)}`)
  }

  e.next()
}, 'users')

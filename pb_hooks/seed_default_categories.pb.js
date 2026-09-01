// CAT-01: a new account starts with a usable set of categories, without the
// user having to create any. Names are user-facing, hence French; the
// fixe/variable split feeds the reports (CAT-03).
//
// CAT-04 adds the icon and the hue. They are written here rather than derived,
// because a derivation cannot know that Alimentation deserves a bowl of rice:
// these eleven are the only names this application will ever know in advance.
// There are eight hues for eleven categories, so three repeat — assigned so
// that no two neighbours in the seeded order share one.
//
// The list lives inside the handler on purpose: PocketBase serialises each
// handler and runs it as an isolated program, so anything declared at file
// scope is undefined by the time this executes.
onRecordAfterCreateSuccess((e) => {
  const defaults = [
    ['Logement', 'fixe', '🏠', 'indigo'],
    ['Abonnements', 'fixe', '🔁', 'sarcelle'],
    ['Éducation', 'fixe', '🎓', 'prune'],
    ['Dettes', 'fixe', '🏦', 'framboise'],
    ['Épargne', 'fixe', '💰', 'vert'],
    ['Alimentation', 'variable', '🍚', 'terracotta'],
    ['Transport', 'variable', '🚕', 'ambre'],
    ['Santé', 'variable', '💊', 'olive'],
    ['Famille', 'variable', '👪', 'indigo'],
    ['Loisirs', 'variable', '🎬', 'prune'],
    ['Autre', 'variable', '🏷️', 'sarcelle'],
  ]

  // The user row is already committed by the time this runs, so a seeding
  // failure must not surface as a failed sign-up: the caller would retry and
  // hit "email already in use", locked out of an account that exists.
  // Guarded per category, not around the loop: one failing save must not cost
  // the user every category that follows it.
  const categories = e.app.findCollectionByNameOrId('categories')

  for (const [name, kind, icon, color] of defaults) {
    try {
      const category = new Record(categories)

      category.set('user', e.record.id)
      category.set('name', name)
      category.set('kind', kind)
      category.set('active', true)
      category.set('icon', icon)
      category.set('color', color)

      e.app.save(category)
    } catch (err) {
      console.warn(`Could not seed category "${name}" for ${e.record.id}: ${String(err)}`)
    }
  }

  e.next()
}, 'users')

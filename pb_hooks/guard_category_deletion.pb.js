// Opening deleteRule on categories brought budgets.category's cascade within
// reach. It is the one relation to categories that cascades, so a delete that
// got through would take every envelope of that category with it — past months
// included — and say nothing about it.
//
// Two things about where this is bound.
//
// It is onRecordDelete*Request*, not onRecordDelete: categories.user cascades
// too, and PocketBase runs the model hooks for cascaded records. On the plain
// hook, closing an account walked its categories one by one, and the parent of
// any sub-category found its child still standing and refused — leaving every
// account that had ever created one impossible to delete (USR-04). Measured.
// The request hook fires only for a delete somebody asked for, which is the
// only case this guard is about.
//
// And the count runs BEFORE e.next(). A guard placed after would refuse the
// category having already destroyed its envelopes.
onRecordDeleteRequest((e) => {
  const HOLDERS = [
    ['transactions', 'category = {:id}'],
    ['budgets', 'category = {:id}'],
    ['categories', 'parent = {:id}'],
  ]

  const scope = { id: e.record.id }

  for (let i = 0; i < HOLDERS.length; i++) {
    // One row is enough: this asks whether anything points here, not how much.
    const found = e.app.findRecordsByFilter(HOLDERS[i][0], HOLDERS[i][1], '', 1, 0, scope)

    if (found.length > 0) {
      throw new BadRequestError('This category is still in use and cannot be deleted.')
    }
  }

  e.next()
}, 'categories')

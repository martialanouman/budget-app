// Opening deleteRule on categories brought budgets.category's cascade within
// reach. It is the one relation to categories that cascades, so a delete that
// got through would take every envelope of that category with it — past months
// included — and say nothing about it.
//
// The count therefore runs BEFORE e.next(). A guard placed after would refuse
// the category and have already destroyed its envelopes.
onRecordDelete((e) => {
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

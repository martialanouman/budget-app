// A transfer is one operation, and has to stay one after it is written. The
// route makes both rows appear together; nothing kept them together
// afterwards, and deleting a single leg through the ordinary API credited an
// account out of nowhere — measured at 200 000 francs where 170 000 stood.
//
// The cascade cannot loop: the partner is looked up only after e.next() has
// removed the current row, so the second leg finds nothing left to delete.
onRecordDelete((e) => {
  const group = e.record.get('transfer_group')

  e.next()

  if (!group) return

  const siblings = e.app.findRecordsByFilter(
    'transactions',
    'transfer_group = {:group}',
    '',
    0,
    0,
    { group: group },
  )

  for (let i = 0; i < siblings.length; i++) {
    e.app.delete(siblings[i])
  }
}, 'transactions')

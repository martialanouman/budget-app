// PocketBase evaluates relation-path conditions such as
// `account.user = @request.auth.id` when a record is created, but not when it
// is updated. Without this guard, a user can create a transaction on their own
// account and then PATCH it onto a stranger's — verified returning 200 — where
// the rightful owner can neither see nor delete it.
//
// The rule strings stay in the migration as the first line of defence; this
// closes the update path they cannot cover.
function assertOwnedReferences(e) {
  const owner = e.record.get('user')
  const accountId = e.record.get('account')
  const categoryId = e.record.get('category')

  const account = e.app.findRecordById('accounts', accountId)

  if (account.get('user') !== owner) {
    throw new BadRequestError('The account must belong to the transaction owner.')
  }

  if (categoryId) {
    const category = e.app.findRecordById('categories', categoryId)

    if (category.get('user') !== owner) {
      throw new BadRequestError('The category must belong to the transaction owner.')
    }
  }

  e.next()
}

onRecordCreate(assertOwnedReferences, 'transactions')
onRecordUpdate(assertOwnedReferences, 'transactions')

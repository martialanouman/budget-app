// PocketBase evaluates relation-path conditions such as
// `account.user = @request.auth.id` when a record is created, but not when it
// is updated. Without this guard, a user can create a record pointing at their
// own account and then PATCH it onto a stranger's — verified returning 200 on
// transactions at step 4, and again on budgets at step 5, where the moved
// envelope renders without a title and never matches the spending view.
//
// The rule strings stay in the migrations as the first line of defence; this
// closes the update path they cannot cover. Every collection holding a
// relation to another of the owner's records belongs here.
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

function assertOwnedCategory(e) {
  const category = e.app.findRecordById('categories', e.record.get('category'))

  if (category.get('user') !== e.record.get('user')) {
    throw new BadRequestError('The category must belong to the budget owner.')
  }

  e.next()
}

onRecordCreate(assertOwnedCategory, 'budgets')
onRecordUpdate(assertOwnedCategory, 'budgets')

function assertOwnedDebt(e) {
  const debt = e.app.findRecordById('debts', e.record.get('debt'))

  if (debt.get('user') !== e.record.get('user')) {
    throw new BadRequestError('The debt must belong to the payment owner.')
  }

  e.next()
}

onRecordCreate(assertOwnedDebt, 'debt_payments')
onRecordUpdate(assertOwnedDebt, 'debt_payments')

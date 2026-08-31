// TRX-05. An entry stays correctable for thirty days after it was recorded,
// and is settled history after that.
//
// The window is counted from `created`, not from `date`: an expense backdated
// to last month but typed this morning is a fresh mistake. `created` carries
// onUpdate: false, so a PATCH cannot move the deadline it is measured against.
//
// Deletion is held to the same window as editing. Left open, it would undo the
// rule in two clicks — delete the old row, type it again at whatever figure
// suits.
//
// Both handlers are the *Request* variants, and that is not a matter of style:
//
//   - keep_transfer_pairs.pb.js removes the sibling leg through e.app.delete(),
//     an internal delete. A model hook would refuse it and leave half a
//     transfer standing — the very thing that file exists to prevent;
//   - users cascades into transactions, and PocketBase runs the model hooks for
//     cascaded records. On onRecordDelete, closing an account with any entry
//     older than a month would fail (USR-04) — the same defect already measured
//     on guard_category_deletion, and twice on account closure itself.
//
// The request hooks fire only for a change somebody asked for, which is the
// only case this deadline is about.
//
// Everything is declared inside each handler: PocketBase runs them as isolated
// programs, and a const at file scope reads as undefined here.
function refuseIfSettled(e) {
  const domain = require(`${__hooks}/lib/domain.cjs`)

  // .string() rather than the value itself: `created` comes back as a DateTime,
  // and the domain parses PocketBase's own format from there.
  if (!domain.remainsEditable(e.record.get('created').string(), new Date().toISOString())) {
    throw new BadRequestError(
      `An entry can only be changed within ${domain.EDIT_WINDOW_DAYS} days of being recorded.`,
    )
  }

  e.next()
}

onRecordUpdateRequest(refuseIfSettled, 'transactions')
onRecordDeleteRequest(refuseIfSettled, 'transactions')

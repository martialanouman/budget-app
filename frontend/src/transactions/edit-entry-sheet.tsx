import { useAccounts } from '@/accounts/accounts-api.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { Sheet } from '@/components/sheet'
import { type Transaction } from '@/lib/collections'
import { QuickEntryForm } from './quick-entry-form.tsx'
import { useUpdateTransaction } from './transactions-api.ts'

/**
 * TRX-05's other half. Correcting a figure was only ever possible by deleting
 * the row and typing it again, which is a poor way to fix a digit.
 *
 * The sheet mounts its children only while open, so the entry's values need no
 * effect to stay in step with the row being corrected — each opening starts
 * from the record it was given.
 */
export function EditEntrySheet({
  entry,
  onClose,
}: {
  entry?: Transaction | undefined
  onClose: () => void
}) {
  return (
    <Sheet open={entry !== undefined} title="Modifier la transaction" onClose={onClose}>
      {entry ? <EditFields entry={entry} onClose={onClose} /> : null}
    </Sheet>
  )
}

function EditFields({ entry, onClose }: { entry: Transaction; onClose: () => void }) {
  const accounts = useAccounts()
  const categories = useCategories()
  const update = useUpdateTransaction()

  if (!accounts.isSuccess || !categories.isSuccess) return <p>Chargement…</p>

  // The entry's own account and category stay on offer even once archived or
  // deactivated: a correction must not silently move an old entry somewhere
  // else just because the screen no longer proposes where it sits.
  const accountOptions = accounts.data.filter(
    (account) => !account.archived || account.id === entry.account,
  )
  const categoryOptions = categories.data.filter(
    (category) => category.active || category.id === entry.category,
  )

  return (
    <QuickEntryForm
      accounts={accountOptions}
      categories={categoryOptions}
      entry={entry}
      failed={update.isError}
      onRecord={(draft) => {
        update.reset()

        return update.mutateAsync({ ...draft, id: entry.id })
      }}
      onRecorded={onClose}
    />
  )
}

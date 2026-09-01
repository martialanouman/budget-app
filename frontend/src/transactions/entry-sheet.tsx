import { useState } from 'react'
import { useAccounts } from '@/accounts/accounts-api.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { Sheet } from '@/components/sheet'
import { QuickEntryForm } from './quick-entry-form.tsx'
import { useRecordTransaction } from './transactions-api.ts'

/**
 * TRX-01's always-visible entry point. Typing an expense is the thing the app
 * is opened for, so it cannot be a destination one navigates to: from any
 * screen it is one tap, then the amount and the category.
 *
 * This is why the shell — which otherwise knows nothing of any module — pulls
 * in the transactions one.
 */
export function EntrySheet() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nouvelle transaction"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-accent text-3xl leading-none text-on-accent shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span aria-hidden="true">+</span>
      </button>

      <Sheet open={open} title="Nouvelle transaction" onClose={() => setOpen(false)}>
        <EntryFields onRecorded={() => setOpen(false)} />
      </Sheet>
    </>
  )
}

/**
 * Its queries only run once the sheet is open — the shell renders this on every
 * screen, and a page nobody records from should pay nothing for the button.
 */
function EntryFields({ onRecorded }: { onRecorded: () => void }) {
  const accounts = useAccounts()
  const categories = useCategories()
  const record = useRecordTransaction()

  if (!accounts.isSuccess || !categories.isSuccess) return <p>Chargement…</p>

  const openAccounts = accounts.data.filter((account) => !account.archived)

  if (openAccounts.length === 0) {
    return <p>Créez d’abord un compte : une transaction se pose forcément sur l’un d’eux.</p>
  }

  return (
    <QuickEntryForm
      accounts={openAccounts}
      categories={categories.data.filter((category) => category.active)}
      failed={record.isError}
      onRecord={(draft) => {
        record.reset()

        return record.mutateAsync(draft)
      }}
      onRecorded={onRecorded}
    />
  )
}

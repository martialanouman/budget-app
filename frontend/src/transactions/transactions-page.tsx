import { formatAmount, toMoney } from '@budget/domain'
import { useEffect, useState } from 'react'
import { useAccounts } from '@/accounts/accounts-api.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { ENTRY_TYPE_LABELS, type Transaction, isCredit, isTransfer } from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
import { QuickEntryForm } from './quick-entry-form.tsx'
import { TransferForm } from './transfer-form.tsx'
import { useTransfer } from './transfers-api.ts'
import {
  type TransactionFilters,
  useDeleteTransaction,
  useRecordTransaction,
  useTransactions,
} from './transactions-api.ts'

const SEARCH_DELAY_MS = 300

/** A row whose amount is out of range costs only itself, never the page. */
function signedAmount(entry: Transaction) {
  try {
    return formatAmount(toMoney(isCredit(entry.type) ? entry.amount : -entry.amount))
  } catch {
    return '—'
  }
}

/** Only a transfer is a transfer: an income typed without a category is not. */
const titleOf = (entry: Transaction) =>
  entry.expand?.category?.name ?? (isTransfer(entry.type) ? 'Virement' : 'Sans catégorie')

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState<string>()

  const accounts = useAccounts()
  const categories = useCategories()
  const entries = useTransactions(filters)
  const recordTransaction = useRecordTransaction()
  const deleteTransaction = useDeleteTransaction()
  const makeTransfer = useTransfer()

  // Debounced: the search box feeds the query key, so every keystroke would
  // otherwise be a cache miss that blanks the list and refetches it whole.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search })),
      SEARCH_DELAY_MS,
    )

    return () => clearTimeout(timer)
  }, [search])

  const allAccounts = accounts.data ?? []
  const allCategories = categories.data ?? []

  // Entry only offers what is still in use; the filters must keep offering
  // everything, since archiving exists to keep past entries readable.
  const openAccounts = allAccounts.filter((account) => !account.archived)
  const activeCategories = allCategories.filter((category) => category.active)

  const ready = accounts.isSuccess && categories.isSuccess

  const remove = (id: string) => {
    if (confirming === id) {
      setConfirming(undefined)
      deleteTransaction.mutate(id)

      return
    }

    setConfirming(id)
  }

  return (
    <AppShell title="Transactions">
      {ready ? (
        <QuickEntryForm
          accounts={openAccounts}
          categories={activeCategories}
          failed={recordTransaction.isError}
          onRecord={(draft) => {
            recordTransaction.reset()

            return recordTransaction.mutateAsync(draft)
          }}
        />
      ) : (
        <p>Chargement…</p>
      )}

      {ready && openAccounts.length >= 2 ? (
        <TransferForm
          accounts={openAccounts}
          today={todayLocally()}
          failed={makeTransfer.isError}
          onTransfer={(request) => {
            makeTransfer.reset()

            return makeTransfer.mutateAsync(request)
          }}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Historique</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Filtrer par compte"
            options={[
              { value: '', label: 'Tous les comptes' },
              ...allAccounts.map((account) => ({
                value: account.id,
                label: account.archived ? `${account.name} (archivé)` : account.name,
              })),
            ]}
            onChange={(event) =>
              setFilters((current) => ({ ...current, account: event.target.value }))
            }
          />
          <SelectField
            label="Filtrer par catégorie"
            options={[
              { value: '', label: 'Toutes les catégories' },
              ...allCategories.map((category) => ({
                value: category.id,
                label: category.active ? category.name : `${category.name} (désactivée)`,
              })),
            ]}
            onChange={(event) =>
              setFilters((current) => ({ ...current, category: event.target.value }))
            }
          />
          <TextField
            label="Rechercher dans les notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {entries.isPending ? <p>Chargement…</p> : null}
        {entries.isError ? <FormError message="Impossible de charger vos transactions." /> : null}
        {deleteTransaction.isError ? (
          <FormError message="La suppression a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {entries.isSuccess && entries.data.length === 0 ? <p>Aucune transaction.</p> : null}

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {(entries.data ?? []).map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 p-3">
              <span className="flex-1">
                <span className="font-medium">{titleOf(entry)}</span>
                <span className="block text-sm text-slate-600">
                  {ENTRY_TYPE_LABELS[entry.type]} · {entry.date.slice(0, 10)} ·{' '}
                  {entry.expand?.account?.name}
                  {entry.note ? ` · ${entry.note}` : ''}
                </span>
              </span>
              <span
                className={
                  isCredit(entry.type)
                    ? 'tabular-nums text-emerald-700'
                    : 'tabular-nums text-slate-900'
                }
              >
                {signedAmount(entry)}
              </span>
              {/* Two steps on purpose: a transaction is hard-deleted, and the
                  button sits millimetres from the amount on a phone. */}
              <button
                type="button"
                onClick={() => remove(entry.id)}
                onBlur={() => setConfirming(undefined)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 aria-pressed:border-red-600 aria-pressed:text-red-700"
                aria-pressed={confirming === entry.id}
              >
                {confirming === entry.id ? 'Confirmer la suppression' : 'Supprimer'}{' '}
                {entry.expand?.category?.name ?? ENTRY_TYPE_LABELS[entry.type]} sur{' '}
                {entry.expand?.account?.name} du {entry.date.slice(0, 10)}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  )
}

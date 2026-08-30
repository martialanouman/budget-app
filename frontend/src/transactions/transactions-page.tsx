import { formatAmount, toMoney } from '@budget/domain'
import { useEffect, useState } from 'react'
import { useAccounts } from '@/accounts/accounts-api.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { ListSkeleton } from '@/components/list-skeleton'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { ENTRY_TYPE_LABELS, type Transaction, isCredit, isTransfer } from '@/lib/collections'
import { dayLabel, todayLocally } from '@/lib/dates.ts'
import { TransferForm } from './transfer-form.tsx'
import { useTransfer } from './transfers-api.ts'
import {
  type TransactionFilters,
  useDeleteTransaction,
  useTransactions,
} from './transactions-api.ts'

const SEARCH_DELAY_MS = 300

/** A figure that cannot be made sense of is missing, never zero. */
function safeAmount(value: number) {
  try {
    return formatAmount(toMoney(value))
  } catch {
    return '—'
  }
}

/** A row whose amount is out of range costs only itself, never the page. */
const signedAmount = (entry: Transaction) =>
  safeAmount(isCredit(entry.type) ? entry.amount : -entry.amount)

/**
 * The list in days, newest first. It arrives sorted by date, so one pass keeps
 * that order without sorting again.
 */
function byDay(entries: Transaction[]) {
  const days: { date: string; entries: Transaction[] }[] = []

  for (const entry of entries) {
    const date = entry.date.slice(0, 10)
    const last = days.at(-1)

    if (last?.date === date) last.entries.push(entry)
    else days.push({ date, entries: [entry] })
  }

  return days
}

/**
 * What left the wallet that day. A transfer moves money between the owner's own
 * accounts, so counting one would inflate a figure that reads as spending.
 */
const spentOn = (entries: Transaction[]) =>
  entries
    .filter((entry) => entry.type === 'depense')
    .reduce((total, entry) => total + entry.amount, 0)

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

  // The transfer form only offers accounts still in use; the filters must keep
  // offering everything, since archiving exists to keep past entries readable.
  const openAccounts = allAccounts.filter((account) => !account.archived)

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
      {/* No entry form here: the "+" button in the shell owns that, from every
          screen. Two ways to type the same expense, one of them reachable only
          after navigating, is the redundancy TRX-01 exists to remove. */}
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

        {entries.isPending ? <ListSkeleton /> : null}
        {entries.isError ? <FormError message="Impossible de charger vos transactions." /> : null}
        {deleteTransaction.isError ? (
          <FormError message="La suppression a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {entries.isSuccess && entries.data.length === 0 ? <p>Aucune transaction.</p> : null}

        <ul className="space-y-4">
          {byDay(entries.data ?? []).map((day) => (
            <li key={day.date}>
              {/* The day carries the date once, so no row has to repeat it. */}
              <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
                <h3 className="text-sm font-medium text-slate-600">{dayLabel(day.date)}</h3>
                {spentOn(day.entries) > 0 ? (
                  <span className="text-sm tabular-nums text-slate-600">
                    {safeAmount(spentOn(day.entries))} dépensé
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                {day.entries.map((entry) => {
                  // Spelled out for the screen reader, short on screen: every row
                  // would otherwise offer a button reading only "Supprimer".
                  const describes = `${entry.expand?.category?.name ?? ENTRY_TYPE_LABELS[entry.type]} sur ${entry.expand?.account?.name} du ${dayLabel(entry.date)}`

                  return (
                    <li key={entry.id} className="flex items-center gap-3 p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{titleOf(entry)}</span>
                        <span className="block truncate text-sm text-slate-600">
                          {ENTRY_TYPE_LABELS[entry.type]} · {entry.expand?.account?.name}
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
                      {/* Two steps on purpose: a transaction is hard-deleted, and
                          the button sits millimetres from the amount on a phone. */}
                      <button
                        type="button"
                        onClick={() => remove(entry.id)}
                        onBlur={() => setConfirming(undefined)}
                        aria-label={
                          confirming === entry.id
                            ? `Confirmer la suppression ${describes}`
                            : `Supprimer ${describes}`
                        }
                        className="shrink-0 min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 aria-pressed:border-red-600 aria-pressed:text-red-700"
                        aria-pressed={confirming === entry.id}
                      >
                        {confirming === entry.id ? 'Confirmer' : 'Supprimer'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  )
}

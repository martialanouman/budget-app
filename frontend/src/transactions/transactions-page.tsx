import { EDIT_WINDOW_DAYS, formatAmount, remainsEditable, toMoney } from '@budget/domain'
import { useEffect, useRef, useState } from 'react'
import { useAccounts } from '@/accounts/accounts-api.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { ListSkeleton } from '@/components/list-skeleton'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { ENTRY_TYPE_LABELS, type Transaction, isCredit, isTransfer } from '@/lib/collections'
import { EditEntrySheet } from './edit-entry-sheet.tsx'
import { dayLabel, monthLabel, monthOf, monthsFrom, todayLocally } from '@/lib/dates.ts'
import { TransferForm } from './transfer-form.tsx'
import { useTransfer } from './transfers-api.ts'
import {
  type TransactionFilters,
  useDeleteTransaction,
  useEarliestMonth,
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

/**
 * TRX-05. Everything settles thirty days after it was recorded. Asked of the
 * domain, which is what the server hook asks too, so the button and the refusal
 * can never disagree.
 */
const stillRemovable = (entry: Transaction, now: string) => remainsEditable(entry.created, now)

/**
 * Correcting is the narrower of the two: a transfer leg is deletable — the pair
 * falls together by design — but never editable on its own, since a PATCH of
 * its type once turned a 30 000 debit into a credit and invented 60 000 F.
 */
const stillCorrectable = (entry: Transaction, now: string) =>
  !isTransfer(entry.type) && stillRemovable(entry, now)

/** Only a transfer is a transfer: an income typed without a category is not. */
const titleOf = (entry: Transaction) =>
  entry.expand?.category?.name ?? (isTransfer(entry.type) ? 'Virement' : 'Sans catégorie')

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState<string>()
  const [editing, setEditing] = useState<Transaction>()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Read once per render rather than per row: every row of a list must answer
  // the same question against the same instant.
  const now = new Date().toISOString()

  const accounts = useAccounts()
  const categories = useCategories()
  const entries = useTransactions(filters)
  const earliest = useEarliestMonth()
  const deleteTransaction = useDeleteTransaction()
  const makeTransfer = useTransfer()

  const loaded = entries.data?.pages.flatMap((page) => page.items) ?? []
  const days = byDay(loaded)

  // The months on offer reach back exactly as far as the history does. Until
  // that single row has been read there is nothing honest to offer but "all".
  const months = earliest.data ? monthsFrom(earliest.data, monthOf(todayLocally())) : []

  // Debounced: the search box feeds the query key, so every keystroke would
  // otherwise be a cache miss that blanks the list and refetches it whole.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search })),
      SEARCH_DELAY_MS,
    )

    return () => clearTimeout(timer)
  }, [search])

  // Watched rather than polled: the sentinel sits after the last row, so the
  // next page is asked for as it comes into view. `fetchNextPage` is a no-op
  // while one is already in flight, so a fast scroll cannot stack requests.
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = entries

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver((rows) => {
      if (rows.some((row) => row.isIntersecting)) void fetchNextPage()
    })

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage])

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
        {/* Said once for the screen rather than on every settled row: the
            absence of the buttons already carries it, and a "plus modifiable"
            label on each line of an old month would be permanent noise. */}
        <p className="text-sm text-muted">
          Une transaction reste modifiable et supprimable pendant {EDIT_WINDOW_DAYS} jours après sa
          saisie.
        </p>

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
          {/* A select rather than <input type="month">: the native control
              renders in the browser's locale, not the page's, so a French
              screen showed an English month. monthLabel names it the same way
              the budgets screen does — one month, one name. */}
          <SelectField
            label="Filtrer par mois"
            options={[
              { value: '', label: 'Tous les mois' },
              ...months.map((month) => ({ value: month, label: monthLabel(month) })),
            ]}
            onChange={(event) =>
              setFilters((current) => ({ ...current, month: event.target.value }))
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
        {entries.isSuccess && loaded.length === 0 ? <p>Aucune transaction.</p> : null}

        <ul className="space-y-4">
          {days.map((day, index) => (
            <li key={day.date}>
              {/* The day carries the date once, so no row has to repeat it. */}
              <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
                <h3 className="text-sm font-medium text-muted">{dayLabel(day.date)}</h3>
                {/* The last day of a page may be cut in two, and half a day's
                    spending is a wrong figure on the screen that reports
                    spending. It is withheld until the day is whole, never
                    shown partial. */}
                {spentOn(day.entries) > 0 && !(hasNextPage && index === days.length - 1) ? (
                  <span className="text-sm tabular-nums text-muted">
                    {safeAmount(spentOn(day.entries))} dépensé
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                {day.entries.map((entry) => {
                  // Spelled out for the screen reader, short on screen: every row
                  // would otherwise offer a button reading only "Supprimer".
                  const describes = `${entry.expand?.category?.name ?? ENTRY_TYPE_LABELS[entry.type]} sur ${entry.expand?.account?.name} du ${dayLabel(entry.date)}`

                  return (
                    <li key={entry.id} className="space-y-2 p-3">
                      {/* The amount shares the first line with the title, so the
                          account and the note get the whole width of the second.
                          Beside the amount they were cut to "Com…" on a phone —
                          which is the row's information, not its decoration. */}
                      <span className="block min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{titleOf(entry)}</span>
                          <span
                            className={
                              isCredit(entry.type)
                                ? 'shrink-0 tabular-nums text-positive'
                                : 'shrink-0 tabular-nums text-ink'
                            }
                          >
                            {signedAmount(entry)}
                          </span>
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {ENTRY_TYPE_LABELS[entry.type]} · {entry.expand?.account?.name}
                          {entry.note ? ` · ${entry.note}` : ''}
                        </span>
                      </span>
                      {/* The actions get their own line rather than the end of
                          the first. Once a row could carry two of them, 390px
                          left the title showing "A…" and the account "Compte …"
                          — the same squeeze the amount caused before it moved
                          up, and the row's information again losing to its
                          controls. Empty when nothing is offered, and the
                          spacing goes with it.

                          Neither button is offered on what the server would
                          refuse: finding the deadline out by losing an edit to
                          it is the wrong order. */}
                      <span className="flex justify-end gap-2 empty:hidden">
                        {stillCorrectable(entry, now) ? (
                          <button
                            type="button"
                            onClick={() => setEditing(entry)}
                            aria-label={`Modifier ${describes}`}
                            className="min-h-11 shrink-0 rounded-md border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          >
                            Modifier
                          </button>
                        ) : null}
                        {stillRemovable(entry, now) ? (
                          <>
                            {/* Two steps on purpose: a transaction is hard-deleted,
                              and the button sits millimetres from the amount on a
                              phone. */}
                            <button
                              type="button"
                              onClick={() => remove(entry.id)}
                              onBlur={() => setConfirming(undefined)}
                              aria-label={
                                confirming === entry.id
                                  ? `Confirmer la suppression ${describes}`
                                  : `Supprimer ${describes}`
                              }
                              className="shrink-0 min-h-11 rounded-md border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-pressed:border-danger aria-pressed:text-danger"
                              aria-pressed={confirming === entry.id}
                            >
                              {confirming === entry.id ? 'Confirmer' : 'Supprimer'}
                            </button>
                          </>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>

        {/* The observer covers scrolling; the button covers everyone it does
            not — a keyboard, a screen reader, a browser that never fires the
            intersection. Neither is a fallback for the other. */}
        {hasNextPage ? (
          <div ref={sentinelRef} className="pt-2">
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
            >
              {isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
            </button>
          </div>
        ) : null}
      </section>

      <EditEntrySheet entry={editing} onClose={() => setEditing(undefined)} />
    </AppShell>
  )
}

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { type Money } from '@budget/domain'
import { type Transaction, type TransactionType } from '@/lib/collections'
import { nextMonth } from '@/lib/dates.ts'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const transactions = () => pb.collection('transactions')

/**
 * Everything a transaction write leaves stale.
 *
 * All of it is derived on the server — three views and the streak — and no
 * realtime channel pushes any of it, so a key left out is a figure that keeps
 * answering with what it read before the user typed.
 *
 * One list rather than three. The three modules that write transactions each
 * kept their own and they had drifted: recording an expense from the dashboard
 * moved the balance while "Dépenses du mois" stayed at zero, "Reste à vivre"
 * stayed at zero and the streak stayed at none. Measured, then found again in
 * review because the streak added a fourth key to a screen that already had
 * three stale ones.
 *
 * Transfers touch neither the monthly totals nor the envelopes (CPT-05), so two
 * of these keys are spare on that path. A spare refetch of one row costs less
 * than a second list to keep in step.
 */
export const TRANSACTION_KEYS = [
  ['transactions'],
  ['account-balances'],
  ['category-usage'],
  ['monthly-summary'],
  ['budget-spending'],
  ['entry-streak'],
] as const

/**
 * Large enough that a phone screen is filled by the first page and most months
 * need only one, small enough that the whole history is never the price of
 * opening the screen. It also bounds what an invalidation costs: TanStack
 * refetches every loaded page, so few large pages beat many small ones.
 */
const PAGE_SIZE = 50

export type TransactionFilters = {
  account?: string
  category?: string
  /** A calendar month, `YYYY-MM`. */
  month?: string
  from?: string
  to?: string
  search?: string
}

export type TransactionDraft = {
  account: string
  category: string
  type: TransactionType
  amount: Money
  date: string
  note: string
}

/** `%` and `_` are LIKE wildcards; pb.filter escapes quotes but leaves these. */
const literal = (text: string) => text.replace(/([%_\\])/gu, '\\$1')

function toFilter(filters: TransactionFilters) {
  const clauses: string[] = []

  if (filters.account) clauses.push(pb.filter('account = {:account}', filters))
  if (filters.category) clauses.push(pb.filter('category = {:category}', filters))
  if (filters.from) clauses.push(pb.filter('date >= {:from}', { from: `${filters.from} 00:00:00` }))
  // Dates are stored as full timestamps, so a date-only upper bound would drop
  // every entry made after midnight on the closing day.
  if (filters.to) clauses.push(pb.filter('date <= {:to}', { to: `${filters.to} 23:59:59` }))
  if (filters.month) {
    // Bounded below by the first of the month and above by the first of the
    // next, which is why nothing here has to know how long a month is.
    clauses.push(
      pb.filter('date >= {:from} && date < {:until}', {
        from: `${filters.month}-01 00:00:00`,
        until: `${nextMonth(filters.month)}-01 00:00:00`,
      }),
    )
  }
  if (filters.search) {
    clauses.push(pb.filter('note ~ {:search}', { search: literal(filters.search) }))
  }

  return clauses.join(' && ')
}

/**
 * Newest first, and total. `date` ties for every entry of a day and `created`
 * ties too — seeded fixtures share an instant, and so do two entries typed
 * within the same millisecond — so without `id` the order between tied rows is
 * left to SQLite, which owes no promise across two calls.
 *
 * Measured, and worth stating plainly: removing `id` does NOT break the paging
 * test. The query plan is the same for both pages, so ties come back in the
 * same order today. `id` is here because that equality is a property of the
 * plan and not of the query — a filter that picks another index would resolve
 * them differently — and because the index added in 1787600000 carries it, so
 * it costs nothing. It is a guard by construction, not a measured fix.
 */
const NEWEST_FIRST = '-date,-created,-id'

export function useTransactions(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      transactions().getList<Transaction>(pageParam, PAGE_SIZE, {
        filter: toFilter(filters),
        sort: NEWEST_FIRST,
        expand: 'account,category',
      }),
    // totalPages is what says whether another page exists, so the count is
    // worth its COUNT(*): skipTotal would leave the list unable to stop.
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  })
}

/**
 * The month of the owner's oldest entry, which bounds the month filter. Asked
 * of the server as a single row rather than derived from what is on screen: the
 * list is paginated, so the entries in hand say nothing about how far back the
 * history goes.
 */
export function useEarliestMonth() {
  return useQuery({
    queryKey: ['transactions', 'earliest'],
    queryFn: async () => {
      const first = await transactions().getList<Transaction>(1, 1, { sort: 'date' })

      // `null` and not `undefined` for an account with no history yet:
      // TanStack Query refuses undefined as data and puts the query into an
      // error state instead — quietly, since the screen falls back to offering
      // no months either way.
      return first.items[0]?.date.slice(0, 7) ?? null
    },
  })
}

// Balances are derived server-side with no realtime channel, so every write
// has to invalidate them explicitly alongside the list. So is what holds a
// category: a spend recorded here decides whether the categories page may
// still offer to delete the category it landed on.
const useTransactionMutation = <TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) => useDerivedMutation<TVariables>(TRANSACTION_KEYS, mutationFn)

export function useRecordTransaction() {
  return useTransactionMutation((draft: TransactionDraft) =>
    transactions().create({ ...draft, user: pb.authStore.record?.id }),
  )
}

export function useDeleteTransaction() {
  return useTransactionMutation((id: string) => transactions().delete(id))
}

export function useUpdateTransaction() {
  return useTransactionMutation(({ id, ...draft }: TransactionDraft & { id: string }) =>
    transactions().update(id, draft),
  )
}

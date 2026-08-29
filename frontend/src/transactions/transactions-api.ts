import { useQuery } from '@tanstack/react-query'
import { type Money } from '@budget/domain'
import { type Transaction, type TransactionType } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const transactions = () => pb.collection('transactions')

export type TransactionFilters = {
  account?: string
  category?: string
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
  if (filters.search) {
    clauses.push(pb.filter('note ~ {:search}', { search: literal(filters.search) }))
  }

  return clauses.join(' && ')
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () =>
      transactions().getFullList<Transaction>({
        filter: toFilter(filters),
        // Entries typed the same day share a midnight timestamp, so `-created`
        // breaks the tie and keeps the newest first.
        sort: '-date,-created',
        expand: 'account,category',
      }),
  })
}

// Balances are derived server-side with no realtime channel, so every write
// has to invalidate them explicitly alongside the list. So is what holds a
// category: a spend recorded here decides whether the categories page may
// still offer to delete the category it landed on.
const useTransactionMutation = <TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) =>
  useDerivedMutation<TVariables>(
    [['transactions'], ['account-balances'], ['category-usage']],
    mutationFn,
  )

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

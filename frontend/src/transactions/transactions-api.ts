import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Money } from '@budget/domain'
import { type Transaction, type TransactionType } from '@/lib/collections'
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

function toFilter(filters: TransactionFilters) {
  const clauses: string[] = []

  if (filters.account) clauses.push(pb.filter('account = {:account}', filters))
  if (filters.category) clauses.push(pb.filter('category = {:category}', filters))
  if (filters.from) clauses.push(pb.filter('date >= {:from}', filters))
  if (filters.to) clauses.push(pb.filter('date <= {:to}', filters))
  if (filters.search) clauses.push(pb.filter('note ~ {:search}', filters))

  return clauses.join(' && ')
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () =>
      transactions().getFullList<Transaction>({
        filter: toFilter(filters),
        sort: '-date',
        expand: 'account,category',
      }),
  })
}

// Balances are derived server-side with no realtime channel, so every write
// has to invalidate them explicitly alongside the list.
function useTransactionMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['account-balances'] }),
      ])
    },
  })
}

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

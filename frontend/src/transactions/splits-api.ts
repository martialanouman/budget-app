import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '@/lib/pocketbase'

export type SplitRequest = {
  account: string
  date: string
  note: string
  parts: { category: string; amount: number }[]
}

/**
 * Server route for the same reason as transfers: a partially written split
 * would show an amount that never matches what was actually spent.
 */
export function splitTransaction(request: SplitRequest) {
  return pb.send<{ split_group: string }>('/api/splits', { method: 'POST', body: request })
}

export function useSplitTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: splitTransaction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['account-balances'] }),
      ])
    },
  })
}

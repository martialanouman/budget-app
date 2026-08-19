import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '@/lib/pocketbase'

export type TransferRequest = {
  from: string
  to: string
  amount: number
  date: string
  note?: string
}

/**
 * Goes through a server route rather than two client writes: a transfer must
 * create both rows or neither, and a dropped connection between two calls
 * would otherwise leave a debit with no matching credit.
 */
export function transfer(request: TransferRequest) {
  return pb.send('/api/transfers', { method: 'POST', body: request })
}

export function useTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: transfer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['account-balances'] }),
      ])
    },
  })
}

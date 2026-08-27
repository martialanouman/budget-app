import { useDerivedMutation } from '@/lib/mutations.ts'
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
  return pb.send<{ transfer_group: string }>('/api/transfers', { method: 'POST', body: request })
}

export function useTransfer() {
  return useDerivedMutation([['transactions'], ['account-balances']], transfer)
}

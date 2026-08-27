import { useQuery } from '@tanstack/react-query'
import { toMoney } from '@budget/domain'
import { type Account, type AccountBalance, type AccountType } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const accounts = () => pb.collection('accounts')

export type AccountDraft = {
  name: string
  type: AccountType
  initialBalance: number
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => accounts().getFullList<Account>({ sort: 'name' }),
  })
}

export function useAccountBalances() {
  return useQuery({
    queryKey: ['account-balances'],
    queryFn: async () => {
      const rows = await pb.collection('account_balances').getFullList<AccountBalance>()

      // Revalidated here rather than at render time, and row by row: an
      // out-of-range figure must cost only its own account a balance, not
      // blank the column for every other one.
      return rows.map((row) => {
        try {
          return { ...row, balance: toMoney(row.balance) }
        } catch {
          return { ...row, balance: undefined }
        }
      })
    },
  })
}

// Every mutation invalidates the balances too: they are derived server-side and
// have no realtime channel to push the change back.
const useAccountMutation = <TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) =>
  useDerivedMutation<TVariables>([['accounts'], ['account-balances']], mutationFn)

export function useCreateAccount() {
  return useAccountMutation((draft: AccountDraft) =>
    accounts().create({
      user: pb.authStore.record?.id,
      name: draft.name,
      type: draft.type,
      initial_balance: draft.initialBalance,
      archived: false,
    }),
  )
}

export function useArchiveAccount() {
  return useAccountMutation((id: string) => accounts().update(id, { archived: true }))
}

export function useRestoreAccount() {
  return useAccountMutation((id: string) => accounts().update(id, { archived: false }))
}

export function useRenameAccount() {
  return useAccountMutation(({ id, name }: { id: string; name: string }) =>
    accounts().update(id, { name }),
  )
}

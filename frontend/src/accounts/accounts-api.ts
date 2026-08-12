import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toMoney } from '@budget/domain'
import { type Account, type AccountBalance, type AccountType } from '@/lib/collections'
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

      // Revalidated here, at the boundary: an out-of-range figure must fail the
      // query — and show the error banner — rather than throw during render and
      // blank the page.
      return rows.map((row) => ({ ...row, balance: toMoney(row.balance) }))
    },
  })
}

// Every mutation invalidates the balances too: they are derived server-side and
// have no realtime channel to push the change back.
function useAccountMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['account-balances'] }),
      ])
    },
  })
}

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

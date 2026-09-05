import { Sheet } from '@/components/sheet'
import { type Account } from '@/lib/collections'
import { AccountForm } from './account-form.tsx'
import { useUpdateAccount } from './accounts-api.ts'

/**
 * CPT-02 on an account that already exists. Same shape as the correction of a
 * transaction and of a category: a sheet, mounting its fields only while open,
 * so each opening starts from the record it was given.
 */
export function EditAccountSheet({
  account,
  onClose,
}: {
  account?: Account | undefined
  onClose: () => void
}) {
  return (
    <Sheet open={account !== undefined} title="Modifier le compte" onClose={onClose}>
      {account ? <EditFields account={account} onClose={onClose} /> : null}
    </Sheet>
  )
}

function EditFields({ account, onClose }: { account: Account; onClose: () => void }) {
  const update = useUpdateAccount()

  return (
    <AccountForm
      account={account}
      failed={update.isError}
      onSave={(fields) => {
        update.reset()

        return update.mutateAsync({ ...fields, id: account.id })
      }}
      onSaved={onClose}
    />
  )
}

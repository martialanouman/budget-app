import { formatAmount } from '@budget/domain'
import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Disclosure } from '@/components/disclosure'
import { FormError } from '@/components/form-feedback'
import { ListSkeleton } from '@/components/list-skeleton'
import { SECONDARY_BUTTON_CLASS } from '@/components/secondary-button.ts'
import { ACCOUNT_TYPE_ICONS, hueClassOf } from '@/lib/appearance'
import { ACCOUNT_TYPE_LABELS, type Account } from '@/lib/collections'
import { AccountForm } from './account-form.tsx'
import { EditAccountSheet } from './edit-account-sheet.tsx'
import {
  useAccountBalances,
  useAccounts,
  useArchiveAccount,
  useCreateAccount,
  useRestoreAccount,
} from './accounts-api.ts'

export function AccountsPage() {
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const createAccount = useCreateAccount()
  const archiveAccount = useArchiveAccount()
  const restoreAccount = useRestoreAccount()
  const [editing, setEditing] = useState<Account>()

  const archive = (id: string) => {
    restoreAccount.reset()
    archiveAccount.mutate(id)
  }

  const restore = (id: string) => {
    archiveAccount.reset()
    restoreAccount.mutate(id)
  }

  // No fallback to initial_balance: presenting a stale figure as the balance
  // would be worse than admitting the value could not be loaded.
  const balanceOf = (account: Account) =>
    balances.data?.find((entry) => entry.id === account.id)?.balance

  const active = accounts.data?.filter((account) => !account.archived) ?? []
  const archived = accounts.data?.filter((account) => account.archived) ?? []

  // Kept apart: an archive failure belongs next to the list, not under the
  // create form it has nothing to do with.
  const listMutationFailed = archiveAccount.isError || restoreAccount.isError

  return (
    <AppShell title="Comptes">
      <Disclosure summary="Ajouter un compte">
        <AccountForm
          failed={createAccount.isError}
          onSave={(fields) => {
            // react-query keeps the last result until the same mutation runs
            // again, so a stale failure would otherwise stay on screen through
            // a success.
            createAccount.reset()

            return createAccount.mutateAsync(fields)
          }}
        />
      </Disclosure>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes comptes</h2>
        {accounts.isPending ? <ListSkeleton /> : null}
        {accounts.isError ? <FormError message="Impossible de charger vos comptes." /> : null}
        {listMutationFailed ? (
          <FormError message="L'opération sur ce compte a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {balances.isError ? <FormError message="Les soldes n'ont pas pu être chargés." /> : null}
        {accounts.isSuccess && active.length === 0 ? <p>Aucun compte pour le moment.</p> : null}
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {active.map((account) => {
            const balance = balanceOf(account)

            return (
              // Name alone on the first line, balance and buttons on the
              // second. Measured at 390px: the type icon and the balance
              // together left "Compte courant BOA" as "Compte couran…", and a
              // truncated name tells nobody which account they are archiving.
              // The balance loses nothing by moving — it is the widest thing
              // in the row and the only one that never truncates.
              <li key={account.id} className="space-y-2 p-3">
                <div className="flex items-center gap-3">
                  {/* Decoration, both of them: the hue is the account's own,
                      the icon is deduced from its type (CPT-02). The name is
                      immediately beside it, so neither ever has to say on its
                      own which account this is. */}
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-field text-lg ${hueClassOf(account.color, account.name)}`}
                  >
                    {ACCOUNT_TYPE_ICONS[account.type]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{account.name}</span>
                    <span className="block text-sm text-muted">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular-nums">
                    {balance === undefined ? '—' : formatAmount(balance)}
                  </span>
                  <span className="flex flex-wrap justify-end gap-2">
                    {/* CPT-02: the name, the type — and so the icon — and the
                        colour, none of which could be touched after the day
                        the account was opened. */}
                    <button
                      type="button"
                      onClick={() => setEditing(account)}
                      aria-label={`Modifier ${account.name}`}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => archive(account.id)}
                      aria-label={`Archiver ${account.name}`}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Archiver
                    </button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {archived.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Comptes archivés</h2>
          {/* No "Modifier" here, and the omission is the point: an archived
              account is out of use, so restoring it is the one thing to do
              with it. Correcting a name nobody can spend from is a button in
              the way of the only one that matters. */}
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {archived.map((account) => (
              <li key={account.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-muted">{account.name}</span>
                <button
                  type="button"
                  onClick={() => restore(account.id)}
                  aria-label={`Restaurer ${account.name}`}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  Restaurer
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EditAccountSheet account={editing} onClose={() => setEditing(undefined)} />
    </AppShell>
  )
}

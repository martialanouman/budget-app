import { zodResolver } from '@hookform/resolvers/zod'
import { formatAmount, parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { AppShell } from '@/components/app-shell'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type Account } from '@/lib/collections'
import {
  useAccountBalances,
  useAccounts,
  useArchiveAccount,
  useCreateAccount,
  useRestoreAccount,
} from './accounts-api.ts'

const schema = z.object({
  // Mirrors the max: 60 on accounts.name; without it the server's rejection
  // reaches the user as a generic failure.
  name: z.string().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  type: z.enum(ACCOUNT_TYPES),
  // Delegated to the domain rather than re-validated here: parseAmount owns
  // what a franc amount is, including the exactly-representable bound that a
  // hand-rolled regex silently dropped.
  initialBalance: z.string().transform((value, ctx) => {
    try {
      return parseAmount(value)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Montant en francs, sans décimale' })

      return z.NEVER
    }
  }),
})

type FormInput = z.input<typeof schema>

export function AccountsPage() {
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const createAccount = useCreateAccount()
  const archiveAccount = useArchiveAccount()
  const restoreAccount = useRestoreAccount()

  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'banque', initialBalance: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    // react-query keeps the last result until the same mutation runs again, so
    // a stale failure would otherwise stay on screen through a success.
    createAccount.reset()

    try {
      await createAccount.mutateAsync(values)
      reset()
    } catch {
      // Surfaced through createAccount.isError below.
    }
  })

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
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium">Ajouter un compte</h2>
        {createAccount.isError ? (
          <FormError message="La création du compte a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        <TextField label="Nom" error={formState.errors.name?.message} {...register('name')} />
        <SelectField
          label="Type"
          options={ACCOUNT_TYPES.map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] }))}
          error={formState.errors.type?.message}
          {...register('type')}
        />
        <TextField
          label="Solde initial"
          inputMode="numeric"
          error={formState.errors.initialBalance?.message}
          {...register('initialBalance')}
        />
        <SubmitButton pending={formState.isSubmitting}>Créer le compte</SubmitButton>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes comptes</h2>
        {accounts.isPending ? <p>Chargement…</p> : null}
        {accounts.isError ? <FormError message="Impossible de charger vos comptes." /> : null}
        {listMutationFailed ? (
          <FormError message="L'opération sur ce compte a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {balances.isError ? <FormError message="Les soldes n'ont pas pu être chargés." /> : null}
        {accounts.isSuccess && active.length === 0 ? <p>Aucun compte pour le moment.</p> : null}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {active.map((account) => {
            const balance = balanceOf(account)

            return (
              <li key={account.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{account.name}</span>
                  <span className="block text-sm text-slate-600">
                    {ACCOUNT_TYPE_LABELS[account.type]}
                  </span>
                </span>
                <span className="tabular-nums">
                  {balance === undefined ? '—' : formatAmount(balance)}
                </span>
                <button
                  type="button"
                  onClick={() => archive(account.id)}
                  aria-label={`Archiver ${account.name}`}
                  className="shrink-0 min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
                >
                  Archiver
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {archived.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Comptes archivés</h2>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {archived.map((account) => (
              <li key={account.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-slate-600">{account.name}</span>
                <button
                  type="button"
                  onClick={() => restore(account.id)}
                  aria-label={`Restaurer ${account.name}`}
                  className="shrink-0 min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
                >
                  Restaurer
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { formatAmount, toMoney } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(ACCOUNT_TYPES),
  // Kept as a string: the field is text input, and the franc has no decimals.
  initialBalance: z
    .string()
    .regex(/^-?\d[\d\s]*$/u, 'Montant en francs, sans décimale')
    .transform((value) => Number(value.replace(/\s/gu, ''))),
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
    await createAccount.mutateAsync(values)
    reset()
  })

  const balanceOf = (account: Account) =>
    balances.data?.find((entry) => entry.id === account.id)?.balance ?? account.initial_balance

  const active = accounts.data?.filter((account) => !account.archived) ?? []
  const archived = accounts.data?.filter((account) => account.archived) ?? []

  return (
    <AppShell title="Comptes">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium">Ajouter un compte</h2>
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
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:opacity-60"
        >
          Créer le compte
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes comptes</h2>
        {accounts.isPending ? <p>Chargement…</p> : null}
        {accounts.isSuccess && active.length === 0 ? <p>Aucun compte pour le moment.</p> : null}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {active.map((account) => (
            <li key={account.id} className="flex items-center gap-3 p-3">
              <span className="flex-1">
                <span className="font-medium">{account.name}</span>
                <span className="block text-sm text-slate-600">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                </span>
              </span>
              <span className="tabular-nums">{formatAmount(toMoney(balanceOf(account)))}</span>
              <button
                type="button"
                onClick={() => void archiveAccount.mutateAsync(account.id)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
              >
                Archiver {account.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {archived.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Comptes archivés</h2>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {archived.map((account) => (
              <li key={account.id} className="flex items-center gap-3 p-3">
                <span className="flex-1 text-slate-600">{account.name}</span>
                <button
                  type="button"
                  onClick={() => void restoreAccount.mutateAsync(account.id)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
                >
                  Restaurer {account.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  )
}

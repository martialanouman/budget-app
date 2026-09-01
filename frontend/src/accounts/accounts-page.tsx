import { zodResolver } from '@hookform/resolvers/zod'
import { formatAmount, parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { ListSkeleton } from '@/components/list-skeleton'
import { AppShell } from '@/components/app-shell'
import { Disclosure } from '@/components/disclosure'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { ChoiceGrid } from '@/components/choice-grid'
import { ACCOUNT_TYPE_ICONS, HUES, HUE_LABELS, hueClass, hueClassOf } from '@/lib/appearance'
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
  // CPT-02. The column has been on the collection since step 3 and nothing had
  // ever written to it. Empty is the ordinary case: an account whose owner
  // chose no colour is given one derived from its name, so a pre-selected hue
  // would have answered for them and painted every account alike.
  color: z.enum(HUES).or(z.literal('')),
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
    defaultValues: { name: '', type: 'banque', initialBalance: '', color: '' },
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
      <Disclosure summary="Ajouter un compte">
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          {createAccount.isError ? (
            <FormError message="La création du compte a échoué. Vérifiez votre connexion et réessayez." />
          ) : null}
          <TextField label="Nom" error={formState.errors.name?.message} {...register('name')} />
          <SelectField
            label="Type"
            options={ACCOUNT_TYPES.map((type) => ({
              value: type,
              label: ACCOUNT_TYPE_LABELS[type],
            }))}
            error={formState.errors.type?.message}
            {...register('type')}
          />
          <TextField
            label="Solde initial"
            inputMode="numeric"
            error={formState.errors.initialBalance?.message}
            {...register('initialBalance')}
          />
          {/* No icon picker, and that is CPT-02 to the letter: an account's
              icon is deduced from its type. Two ways to say the same thing
              could only disagree. */}
          <ChoiceGrid
            legend="Couleur"
            hint="Sans choix, elle est dérivée du nom."
            options={HUES.map((hue) => ({
              value: hue,
              label: HUE_LABELS[hue],
              swatch: <span className={`size-6 rounded-full ${hueClass(hue)}`} />,
            }))}
            {...register('color')}
          />
          <SubmitButton pending={formState.isSubmitting}>Créer le compte</SubmitButton>
        </form>
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
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {active.map((account) => {
            const balance = balanceOf(account)

            return (
              // Name alone on the first line, balance and button on the
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
                <div className="flex items-center justify-between gap-3">
                  <span className="tabular-nums">
                    {balance === undefined ? '—' : formatAmount(balance)}
                  </span>
                  <button
                    type="button"
                    onClick={() => archive(account.id)}
                    aria-label={`Archiver ${account.name}`}
                    className="min-h-11 shrink-0 rounded-md border border-line-strong px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Archiver
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {archived.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Comptes archivés</h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {archived.map((account) => (
              <li key={account.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-muted">{account.name}</span>
                <button
                  type="button"
                  onClick={() => restore(account.id)}
                  aria-label={`Restaurer ${account.name}`}
                  className="shrink-0 min-h-11 rounded-md border border-line-strong px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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

import { zodResolver } from '@hookform/resolvers/zod'
import { formatAmount, parseAmount, toMoney } from '@budget/domain'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAccounts } from '@/accounts/accounts-api.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS, type Transaction } from '@/lib/collections'
import {
  type TransactionFilters,
  useDeleteTransaction,
  useRecordTransaction,
  useTransactions,
} from './transactions-api.ts'

const today = () => new Date().toISOString().slice(0, 10)

const schema = z.object({
  amount: z.string().transform((value, ctx) => {
    try {
      const amount = parseAmount(value)

      if (amount <= 0) throw new Error('not positive')

      return amount
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Montant en francs, supérieur à zéro' })

      return z.NEVER
    }
  }),
  type: z.enum(TRANSACTION_TYPES),
  account: z.string().min(1, 'Compte requis'),
  category: z.string().min(1, 'Catégorie requise'),
  date: z.string().min(1, 'Date requise'),
  note: z.string().max(200, '200 caractères maximum'),
})

type FormInput = z.input<typeof schema>

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({})

  const accounts = useAccounts()
  const categories = useCategories()
  const entries = useTransactions(filters)
  const recordTransaction = useRecordTransaction()
  const deleteTransaction = useDeleteTransaction()

  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      type: 'depense',
      account: '',
      category: '',
      date: today(),
      note: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    recordTransaction.reset()

    try {
      await recordTransaction.mutateAsync(values)
      reset({ ...values, amount: '', note: '' })
    } catch {
      // Surfaced through recordTransaction.isError below.
    }
  })

  const openAccounts = (accounts.data ?? []).filter((account) => !account.archived)
  const activeCategories = (categories.data ?? []).filter((category) => category.active)

  const signed = (entry: Transaction) =>
    formatAmount(toMoney(entry.type === 'revenu' ? entry.amount : -entry.amount))

  return (
    <AppShell title="Transactions">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium">Saisie rapide</h2>
        {recordTransaction.isError ? (
          <FormError message="L'enregistrement a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        <TextField
          label="Montant"
          inputMode="numeric"
          autoFocus
          error={formState.errors.amount?.message}
          {...register('amount')}
        />
        <SelectField
          label="Type"
          options={TRANSACTION_TYPES.map((type) => ({
            value: type,
            label: TRANSACTION_TYPE_LABELS[type],
          }))}
          {...register('type')}
        />
        <SelectField
          label="Compte"
          options={openAccounts.map((account) => ({ value: account.id, label: account.name }))}
          error={formState.errors.account?.message}
          {...register('account')}
        />
        <SelectField
          label="Catégorie"
          options={activeCategories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          error={formState.errors.category?.message}
          {...register('category')}
        />
        <TextField
          label="Date"
          type="date"
          error={formState.errors.date?.message}
          {...register('date')}
        />
        <TextField label="Note" error={formState.errors.note?.message} {...register('note')} />
        <SubmitButton pending={formState.isSubmitting}>Enregistrer</SubmitButton>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Historique</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Filtrer par compte"
            options={[
              { value: '', label: 'Tous les comptes' },
              ...openAccounts.map((account) => ({ value: account.id, label: account.name })),
            ]}
            onChange={(event) =>
              setFilters((current) => ({ ...current, account: event.target.value }))
            }
          />
          <SelectField
            label="Filtrer par catégorie"
            options={[
              { value: '', label: 'Toutes les catégories' },
              ...activeCategories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
            onChange={(event) =>
              setFilters((current) => ({ ...current, category: event.target.value }))
            }
          />
          <TextField
            label="Rechercher dans les notes"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
        </div>

        {entries.isPending ? <p>Chargement…</p> : null}
        {entries.isError ? <FormError message="Impossible de charger vos transactions." /> : null}
        {deleteTransaction.isError ? (
          <FormError message="La suppression a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {entries.isSuccess && entries.data.length === 0 ? <p>Aucune transaction.</p> : null}

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {(entries.data ?? []).map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 p-3">
              <span className="flex-1">
                <span className="font-medium">
                  {entry.expand?.category?.name ?? 'Sans catégorie'}
                </span>
                <span className="block text-sm text-slate-600">
                  {entry.date.slice(0, 10)} · {entry.expand?.account?.name}
                  {entry.note ? ` · ${entry.note}` : ''}
                </span>
              </span>
              <span
                className={
                  entry.type === 'revenu'
                    ? 'tabular-nums text-emerald-700'
                    : 'tabular-nums text-slate-900'
                }
              >
                {signed(entry)}
              </span>
              <button
                type="button"
                onClick={() => deleteTransaction.mutate(entry.id)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
              >
                Supprimer {entry.expand?.category?.name ?? 'la transaction'} du{' '}
                {entry.date.slice(0, 10)}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  )
}

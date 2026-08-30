import { zodResolver } from '@hookform/resolvers/zod'
import { parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { todayLocally } from '@/lib/dates.ts'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import {
  type Account,
  type Category,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
} from '@/lib/collections'
import type { TransactionDraft } from './transactions-api.ts'

/** Local calendar day, not the UTC one: an entry made after midnight in UTC+1 belongs to today. */
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

/**
 * Mounted only once accounts and categories are known. A select whose initial
 * value has no matching option leaves the browser showing one thing and the
 * form holding another, with no change event to reconcile them — and the entry
 * becomes impossible to submit.
 */
export function QuickEntryForm({
  accounts,
  categories,
  failed,
  onRecord,
  onRecorded,
}: {
  accounts: Account[]
  categories: Category[]
  failed: boolean
  onRecord: (draft: TransactionDraft) => Promise<unknown>
  /** Called once the entry is in and the form has been reset, never before. */
  onRecorded?: (() => void) | undefined
}) {
  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      type: 'depense',
      // Prefilled, since most people have one account and the entry should
      // take seconds. The category stays a deliberate choice.
      account: accounts[0]?.id ?? '',
      category: '',
      date: todayLocally(),
      note: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onRecord(values)
      reset({ ...values, amount: '', note: '' })
      onRecorded?.()
    } catch {
      // Surfaced through `failed` below.
    }
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      {failed ? (
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
        options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        error={formState.errors.account?.message}
        {...register('account')}
      />
      <SelectField
        label="Catégorie"
        options={[
          { value: '', label: 'Choisir une catégorie' },
          ...categories.map((category) => ({ value: category.id, label: category.name })),
        ]}
        error={formState.errors.category?.message}
        {...register('category')}
      />
      {/* Today and no note are right almost every time. Folded away they cost
          nothing to skip and stay one tap from being changed — which is the
          difference between a ten-second entry and a six-field one. */}
      <details className="rounded-md border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-slate-700">
          Date et note
        </summary>
        <div className="space-y-4 border-t border-slate-200 p-3">
          <TextField
            label="Date"
            type="date"
            error={formState.errors.date?.message}
            {...register('date')}
          />
          <TextField label="Note" error={formState.errors.note?.message} {...register('note')} />
        </div>
      </details>
      <SubmitButton pending={formState.isSubmitting}>Enregistrer</SubmitButton>
    </form>
  )
}

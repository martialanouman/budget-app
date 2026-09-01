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
  type Transaction,
  isTransactionType,
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
  entry,
  onRecord,
  onRecorded,
}: {
  accounts: Account[]
  categories: Category[]
  failed: boolean
  /**
   * The entry being corrected, absent when one is being typed. One form and one
   * schema for both: a second copy would be a second place for the rules on an
   * amount to drift.
   */
  entry?: Transaction | undefined
  onRecord: (draft: TransactionDraft) => Promise<unknown>
  /** Called once the entry is in and the form has been reset, never before. */
  onRecorded?: (() => void) | undefined
}) {
  const correcting = entry !== undefined
  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: entry
      ? {
          // Plain digits rather than the formatted figure: parseAmount reads
          // them, and no round trip through a display format can go wrong.
          amount: String(entry.amount),
          // A transfer leg has a type this form does not offer, and is refused
          // by the server anyway — the screen never opens one here.
          type: isTransactionType(entry.type) ? entry.type : 'depense',
          account: entry.account,
          category: entry.category,
          date: entry.date.slice(0, 10),
          note: entry.note,
        }
      : {
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
      // Clearing the amount sets up the next entry; on a correction it would
      // wipe what was just saved out from under the person who saved it. The
      // amount goes back as a string either way: the schema parses one on the
      // way in and hands back a Money on the way out.
      reset(
        correcting
          ? { ...values, amount: String(values.amount) }
          : { ...values, amount: '', note: '' },
      )
      onRecorded?.()
    } catch {
      // Surfaced through `failed` below.
    }
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      {failed ? (
        <FormError
          message={
            correcting
              ? 'La modification a échoué. Vérifiez votre connexion et réessayez.'
              : "L'enregistrement a échoué. Vérifiez votre connexion et réessayez."
          }
        />
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
      <details className="rounded-md border border-line bg-surface">
        <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-ink">
          Date et note
        </summary>
        <div className="space-y-4 border-t border-line p-3">
          <TextField
            label="Date"
            type="date"
            error={formState.errors.date?.message}
            {...register('date')}
          />
          <TextField label="Note" error={formState.errors.note?.message} {...register('note')} />
        </div>
      </details>
      <SubmitButton pending={formState.isSubmitting}>
        {correcting ? 'Enregistrer les modifications' : 'Enregistrer'}
      </SubmitButton>
    </form>
  )
}

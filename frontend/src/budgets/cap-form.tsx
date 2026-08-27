import { zodResolver } from '@hookform/resolvers/zod'
import { parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { type Category } from '@/lib/collections'
import type { CapDraft } from './budgets-api.ts'

const schema = z.object({
  category: z.string().min(1, 'Catégorie requise'),
  cap: z.string().transform((value, ctx) => {
    try {
      const amount = parseAmount(value)

      if (amount <= 0) throw new Error('not positive')

      return amount
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Montant en francs, supérieur à zéro' })

      return z.NEVER
    }
  }),
  carryOver: z.boolean(),
})

type FormInput = z.input<typeof schema>

/** Mounted only once the categories are known, so the select default matches an option. */
export function CapForm({
  categories,
  month,
  failed,
  onSetCap,
}: {
  categories: Category[]
  month: string
  failed: boolean
  onSetCap: (draft: CapDraft) => Promise<unknown>
}) {
  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { category: categories[0]?.id ?? '', cap: '', carryOver: false },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onSetCap({ ...values, month })
      reset({ ...values, cap: '' })
    } catch {
      // Surfaced through `failed` below.
    }
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      <h2 className="text-lg font-medium">Définir une enveloppe</h2>
      {failed ? <FormError message="Le plafond n'a pas pu être enregistré." /> : null}
      <SelectField
        label="Catégorie"
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
        error={formState.errors.category?.message}
        {...register('category')}
      />
      <TextField
        label="Plafond mensuel"
        inputMode="numeric"
        error={formState.errors.cap?.message}
        {...register('cap')}
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="size-4" {...register('carryOver')} />
        Reporter le solde non dépensé sur le mois suivant
      </label>
      <SubmitButton pending={formState.isSubmitting}>Définir le plafond</SubmitButton>
    </form>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { TextField } from '@/components/text-field'
import { todayLocally } from '@/lib/dates.ts'

const schema = z.object({
  amount: z.string().transform((value, ctx) => {
    try {
      const parsed = parseAmount(value)

      if (parsed <= 0) throw new Error('not positive')

      return parsed
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Montant en francs, supérieur à zéro' })

      return z.NEVER
    }
  }),
  date: z.string().min(1, 'Date requise'),
})

type FormInput = z.input<typeof schema>

export function PaymentForm({
  failed,
  onRecord,
}: {
  failed: boolean
  onRecord: (payment: { amount: number; date: string }) => Promise<unknown>
}) {
  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', date: todayLocally() },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onRecord(values)
      reset({ amount: '', date: values.date })
    } catch {
      // Surfaced through `failed` below.
    }
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      <h2 className="text-lg font-medium">Enregistrer un remboursement</h2>
      {failed ? <FormError message="Le remboursement n'a pas pu être enregistré." /> : null}
      <TextField
        label="Montant remboursé"
        inputMode="numeric"
        error={formState.errors.amount?.message}
        {...register('amount')}
      />
      <TextField
        label="Date du remboursement"
        type="date"
        error={formState.errors.date?.message}
        {...register('date')}
      />
      <SubmitButton pending={formState.isSubmitting}>Enregistrer le remboursement</SubmitButton>
    </form>
  )
}

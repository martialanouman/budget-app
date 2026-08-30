import { zodResolver } from '@hookform/resolvers/zod'
import { parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { Disclosure } from '@/components/disclosure'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import {
  DEBT_DIRECTIONS,
  DEBT_DIRECTION_LABELS,
  DEBT_KINDS,
  DEBT_KIND_LABELS,
} from '@/lib/collections'
import { todayLocally } from '@/lib/dates.ts'
import type { DebtDraft } from './debts-api.ts'

const amount = (message: string) =>
  z.string().transform((value, ctx) => {
    try {
      const parsed = parseAmount(value)

      if (parsed <= 0) throw new Error('not positive')

      return parsed
    } catch {
      ctx.addIssue({ code: 'custom', message })

      return z.NEVER
    }
  })

const schema = z.object({
  creditor: z.string().min(1, 'Créancier requis'),
  kind: z.string().min(1, 'Type requis'),
  direction: z.string().min(1, 'Sens requis'),
  initialAmount: amount('Montant en francs, supérieur à zéro'),
  monthlyPayment: amount('Mensualité en francs, supérieure à zéro'),
  // A rate is not an amount: it may carry decimals, and it is optional —
  // family debts and tontines usually carry none.
  interestRate: z.string().transform((value, ctx) => {
    if (value.trim() === '') return 0

    const parsed = Number(value.replace(',', '.'))

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      ctx.addIssue({ code: 'custom', message: 'Taux annuel entre 0 et 100' })

      return z.NEVER
    }

    return parsed
  }),
  dueDay: z.string().transform((value, ctx) => {
    const parsed = Number(value)

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
      ctx.addIssue({ code: 'custom', message: 'Jour du mois, entre 1 et 31' })

      return z.NEVER
    }

    return parsed
  }),
  startDate: z.string().min(1, 'Date requise'),
})

type FormInput = z.input<typeof schema>

export function DebtForm({
  failed,
  onCreate,
}: {
  failed: boolean
  onCreate: (draft: DebtDraft) => Promise<unknown>
}) {
  const { register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      creditor: '',
      kind: DEBT_KINDS[0],
      direction: DEBT_DIRECTIONS[0],
      initialAmount: '',
      monthlyPayment: '',
      interestRate: '',
      dueDay: '5',
      startDate: todayLocally(),
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onCreate(values)
      reset()
    } catch {
      // Surfaced through `failed` below.
    }
  })

  return (
    <Disclosure summary="Nouvelle dette">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        {failed ? <FormError message="La dette n'a pas pu être enregistrée." /> : null}
        <TextField
          label="Créancier"
          error={formState.errors.creditor?.message}
          {...register('creditor')}
        />
        <SelectField
          label="Type"
          options={DEBT_KINDS.map((kind) => ({ value: kind, label: DEBT_KIND_LABELS[kind] }))}
          error={formState.errors.kind?.message}
          {...register('kind')}
        />
        <SelectField
          label="Sens"
          options={DEBT_DIRECTIONS.map((direction) => ({
            value: direction,
            label: DEBT_DIRECTION_LABELS[direction],
          }))}
          error={formState.errors.direction?.message}
          {...register('direction')}
        />
        <TextField
          label="Montant emprunté"
          inputMode="numeric"
          error={formState.errors.initialAmount?.message}
          {...register('initialAmount')}
        />
        <TextField
          label="Mensualité"
          inputMode="numeric"
          error={formState.errors.monthlyPayment?.message}
          {...register('monthlyPayment')}
        />
        <TextField
          label="Taux annuel (%)"
          inputMode="decimal"
          error={formState.errors.interestRate?.message}
          {...register('interestRate')}
        />
        <TextField
          label="Jour d’échéance"
          inputMode="numeric"
          error={formState.errors.dueDay?.message}
          {...register('dueDay')}
        />
        <TextField
          label="Date de début"
          type="date"
          error={formState.errors.startDate?.message}
          {...register('startDate')}
        />
        <SubmitButton pending={formState.isSubmitting}>Ajouter la dette</SubmitButton>
      </form>
    </Disclosure>
  )
}

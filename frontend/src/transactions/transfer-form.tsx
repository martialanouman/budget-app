import { zodResolver } from '@hookform/resolvers/zod'
import { parseAmount } from '@budget/domain'
import { useController, useForm } from 'react-hook-form'
import { z } from 'zod'
import { AmountField } from '@/components/amount-field'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { Disclosure } from '@/components/disclosure'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { type Account } from '@/lib/collections'
import type { TransferRequest } from './transfers-api.ts'

const schema = z
  .object({
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
    from: z.string().min(1, 'Compte source requis'),
    to: z.string().min(1, 'Compte destinataire requis'),
    date: z.string().min(1, 'Date requise'),
  })
  .refine((values) => values.from !== values.to, {
    message: 'Choisissez deux comptes différents',
    path: ['to'],
  })

type FormInput = z.input<typeof schema>

/** Mounted only once the accounts are known, so every select default matches an option. */
export function TransferForm({
  accounts,
  today,
  failed,
  onTransfer,
}: {
  accounts: Account[]
  today: string
  failed: boolean
  onTransfer: (request: TransferRequest) => Promise<unknown>
}) {
  const { control, register, handleSubmit, reset, formState } = useForm<
    FormInput,
    unknown,
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      from: accounts[0]?.id ?? '',
      to: accounts[1]?.id ?? '',
      date: today,
    },
  })

  const amount = useController({ control, name: 'amount' })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onTransfer(values)
      reset({ ...values, amount: '' })
    } catch {
      // Surfaced through `failed` below.
    }
  })

  const options = accounts.map((account) => ({ value: account.id, label: account.name }))

  return (
    <Disclosure summary="Virement entre comptes">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        {failed ? (
          <FormError message="Le virement a échoué. Aucun mouvement n'a été enregistré." />
        ) : null}
        <AmountField
          label="Montant à transférer"
          error={formState.errors.amount?.message}
          value={amount.field.value}
          onChange={amount.field.onChange}
        />
        <SelectField
          label="Depuis le compte"
          options={options}
          error={formState.errors.from?.message}
          {...register('from')}
        />
        <SelectField
          label="Vers le compte"
          options={options}
          error={formState.errors.to?.message}
          {...register('to')}
        />
        <TextField
          label="Date du virement"
          type="date"
          error={formState.errors.date?.message}
          {...register('date')}
        />
        <SubmitButton pending={formState.isSubmitting}>Transférer</SubmitButton>
      </form>
    </Disclosure>
  )
}

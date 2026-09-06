import { zodResolver } from '@hookform/resolvers/zod'
import { parseAmount } from '@budget/domain'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { HueGrid } from '@/components/hue-grid'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { HUES, hueOf } from '@/lib/appearance'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type Account } from '@/lib/collections'

const schema = z.object({
  // Mirrors the max: 60 on accounts.name; without it the server's rejection
  // reaches the user as a generic failure.
  name: z.string().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  type: z.enum(ACCOUNT_TYPES),
  // CPT-02. Empty is the ordinary case on creation: an account whose owner
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
export type AccountFields = z.infer<typeof schema>

/**
 * One form for opening an account and for correcting one (CPT-02).
 *
 * There is no icon picker on either, and that is CPT-02 to the letter: an
 * account's icon is deduced from its type. Which makes the type the only way to
 * correct one — an account opened as a bank account when it is mobile money
 * wore a bank for good until this form existed.
 *
 * The opening balance is on the correction too, and it is the one field here
 * that moves figures already on screen. It is offered because there is no other
 * way back from a mistyped one: an account cannot be deleted, only archived, so
 * the alternative was carrying the wrong total for ever or abandoning the
 * account and its history. Nothing is rewritten by the change — every balance
 * in this application is summed from the entries at read time.
 *
 * The colour grid rests on "Aucune" when creating and on the hue the row wears
 * when correcting. Pre-selecting a hue on creation is an answer nobody gave;
 * leaving the grid blank on a correction hides that the hue is derived from the
 * name, so correcting a spelling repainted the row on the way past.
 */
export function AccountForm({
  account,
  failed,
  onSave,
  onSaved,
}: {
  /** The account being corrected, absent when one is being opened. */
  account?: Account | undefined
  failed: boolean
  onSave: (fields: AccountFields) => Promise<unknown>
  /** Called once the write is in and the form has been reset, never before. */
  onSaved?: (() => void) | undefined
}) {
  const correcting = account !== undefined

  const { register, handleSubmit, reset, formState } = useForm<FormInput, unknown, AccountFields>({
    resolver: zodResolver(schema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type,
          color: hueOf(account.color, account.name),
          // Plain digits rather than the formatted figure: parseAmount reads
          // them, and no round trip through a display format can go wrong.
          initialBalance: String(account.initial_balance),
        }
      : { name: '', type: 'banque', color: '', initialBalance: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onSave(values)
      reset(correcting ? { ...values, initialBalance: String(values.initialBalance) } : undefined)
      onSaved?.()
    } catch {
      // Surfaced through `failed` above.
    }
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      {failed ? (
        <FormError
          message={
            correcting
              ? 'La modification a échoué. Vérifiez votre connexion et réessayez.'
              : 'La création du compte a échoué. Vérifiez votre connexion et réessayez.'
          }
        />
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
      <HueGrid {...register('color')} />
      <SubmitButton pending={formState.isSubmitting}>
        {correcting ? 'Enregistrer les modifications' : 'Créer le compte'}
      </SubmitButton>
    </form>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { TextField } from '@/components/text-field'
import {
  type ChangeEmailValues,
  type ChangePasswordValues,
  changeEmailSchema,
  changePasswordSchema,
} from '@/auth/auth-schemas.ts'
import { changePassword, requestEmailChange, setSecondFactor, useAuth } from '@/auth/auth.ts'

/**
 * The three things one does to one's own credentials, each in its own form so
 * that a failure in one never blanks the others.
 *
 * They live beside the profile rather than inside it because they behave
 * differently from a name: two of the three end the current session, and the
 * third only takes effect somewhere else entirely.
 */
export function SecuritySection() {
  return (
    <>
      <PasswordForm />
      <EmailForm />
      <SecondFactorToggle />
    </>
  )
}

function PasswordForm() {
  const [serverError, setServerError] = useState<string>()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, reset, formState } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = handleSubmit(async ({ current, password, passwordConfirm }) => {
    setServerError(undefined)
    setDone(false)
    try {
      await changePassword(current, password, passwordConfirm)
      reset()
      setDone(true)
    } catch {
      // Deliberately does not distinguish a wrong current password from a
      // refused new one: the server answers both the same way, and guessing
      // which it was would sometimes be a lie.
      setServerError('Le changement a échoué. Vérifiez votre mot de passe actuel.')
    }
  })

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Mot de passe</h2>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3" noValidate>
        <FormError message={serverError} />
        {done ? (
          <p role="status" className="text-sm text-slate-600">
            Votre mot de passe a été modifié.
          </p>
        ) : null}
        <TextField
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          error={formState.errors.current?.message}
          {...register('current')}
        />
        <TextField
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirmer le nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={formState.errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
        />
        <SubmitButton pending={formState.isSubmitting}>Changer mon mot de passe</SubmitButton>
      </form>
    </section>
  )
}

function EmailForm() {
  const { email } = useAuth()
  const [serverError, setServerError] = useState<string>()
  const [sentTo, setSentTo] = useState<string>()
  const { register, handleSubmit, reset, formState } = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined)
    setSentTo(undefined)
    try {
      await requestEmailChange(values.email)
      reset()
      setSentTo(values.email)
    } catch {
      setServerError('L’envoi a échoué. Vérifiez l’adresse et réessayez.')
    }
  })

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Adresse e-mail</h2>
      <p className="text-sm text-slate-600">
        Votre adresse actuelle est {email}. La nouvelle ne prendra effet qu’une fois le lien de
        confirmation ouvert depuis celle-ci.
      </p>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3" noValidate>
        <FormError message={serverError} />
        {/* Names the address on purpose: a link sent to a mistyped address is
            silence, and the only way to notice the typo is to read it back. */}
        {sentTo ? (
          <p role="status" className="text-sm text-slate-600">
            Un lien de confirmation a été envoyé à {sentTo}. Votre adresse actuelle reste active
            jusque-là.
          </p>
        ) : null}
        <TextField
          label="Nouvelle adresse e-mail"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <SubmitButton pending={formState.isSubmitting}>
          Envoyer le lien de confirmation
        </SubmitButton>
      </form>
    </section>
  )
}

function SecondFactorToggle() {
  const { mfaEnabled } = useAuth()
  const [serverError, setServerError] = useState<string>()
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    setServerError(undefined)
    setPending(true)
    try {
      await setSecondFactor(!mfaEnabled)
    } catch {
      setServerError('Le changement a échoué. Vérifiez votre connexion et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Double authentification</h2>
      <p className="text-sm text-slate-600">
        {mfaEnabled
          ? 'À chaque connexion, un code vous est envoyé par e-mail en plus du mot de passe.'
          : 'Ajoutez un code envoyé par e-mail à chaque connexion, en plus du mot de passe.'}
      </p>
      <FormError message={serverError} />
      {/* aria-pressed rather than a checkbox: it is a switch that acts at once,
          not a field waiting to be submitted with something else. */}
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={mfaEnabled}
        className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:opacity-60"
      >
        {mfaEnabled
          ? 'Désactiver la double authentification'
          : 'Activer la double authentification'}
      </button>
    </section>
  )
}

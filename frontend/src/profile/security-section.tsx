import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
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
import {
  changePassword,
  disableSecondFactor,
  enableSecondFactor,
  requestEmailChange,
  useAuth,
} from '@/auth/auth.ts'

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
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, reset, formState } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = handleSubmit(async ({ current, password, passwordConfirm }) => {
    setServerError(undefined)
    setDone(false)
    try {
      // An account with a second factor cannot be signed back in from here —
      // the code is not in hand — so the session ends and the sign-in screen
      // is where it ends. Reporting a failure over a password that did change
      // is what this replaces.
      if (!(await changePassword(current, password, passwordConfirm))) {
        await navigate({ to: '/sign-in' })

        return
      }

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
          <p role="status" className="text-sm text-muted">
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
      <p className="text-sm text-muted">
        Votre adresse actuelle est {email}. La nouvelle ne prendra effet qu’une fois le lien de
        confirmation ouvert depuis celle-ci.
      </p>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3" noValidate>
        <FormError message={serverError} />
        {/* Names the address on purpose: a link sent to a mistyped address is
            silence, and the only way to notice the typo is to read it back. */}
        {sentTo ? (
          <p role="status" className="text-sm text-muted">
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

const TOGGLE =
  'min-h-11 rounded-md border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60'

/**
 * Asymmetric on purpose. Turning the factor ON adds protection, so a click is
 * enough; turning it OFF removes it, and removal is the thing an intruder
 * wants. Asking nothing made this the weakest part of what it guards — a
 * borrowed phone or a lifted token was enough, and silently.
 */
function SecondFactorToggle() {
  const { mfaEnabled } = useAuth()
  const [password, setPassword] = useState('')
  const [serverError, setServerError] = useState<string>()
  const [pending, setPending] = useState(false)

  const run = async (act: () => Promise<unknown>, failure: string) => {
    setServerError(undefined)
    setPending(true)
    try {
      await act()
      setPassword('')
    } catch {
      setServerError(failure)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Double authentification</h2>
      <p className="text-sm text-muted">
        {mfaEnabled
          ? 'À chaque connexion, un code vous est envoyé par e-mail en plus du mot de passe.'
          : 'Ajoutez un code envoyé par e-mail à chaque connexion, en plus du mot de passe.'}
      </p>
      <FormError message={serverError} />
      {mfaEnabled ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void run(
              () => disableSecondFactor(password),
              'Le mot de passe est incorrect. La double authentification reste active.',
            )
          }}
          className="space-y-3"
        >
          <TextField
            label="Mot de passe, pour désactiver"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" disabled={pending} aria-pressed className={TOGGLE}>
            Désactiver la double authentification
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() =>
            void run(
              enableSecondFactor,
              'Le changement a échoué. Vérifiez votre connexion et réessayez.',
            )
          }
          disabled={pending}
          aria-pressed={false}
          className={TOGGLE}
        >
          Activer la double authentification
        </button>
      )}
    </section>
  )
}

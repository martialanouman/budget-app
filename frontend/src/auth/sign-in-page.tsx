import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/text-field'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { AuthLayout } from './auth-layout.tsx'
import { SecondFactorRequired, completeSignIn, requestSignInCode, signIn } from './auth.ts'
import { type SignInValues, signInSchema } from './auth-schemas.ts'

/** What the first half of the sign-in leaves behind for the second. */
type Challenge = { mfaId: string; otpId: string; email: string }

export function SignInPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const [challenge, setChallenge] = useState<Challenge>()
  const { register, handleSubmit, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(undefined)
    try {
      await signIn(email, password)
      await navigate({ to: '/' })
    } catch (cause) {
      // The password was right; what is missing is the second factor. Telling
      // somebody their password is wrong here would send them to reset a
      // password that works.
      if (cause instanceof SecondFactorRequired) {
        try {
          setChallenge({ mfaId: cause.mfaId, otpId: await requestSignInCode(email), email })
        } catch {
          setServerError('Impossible d’envoyer le code. Réessayez dans un instant.')
        }

        return
      }

      setServerError('E-mail ou mot de passe incorrect.')
    }
  })

  if (challenge) {
    return (
      <SecondFactorForm
        challenge={challenge}
        onSignedIn={() => navigate({ to: '/' })}
        onGiveUp={() => setChallenge(undefined)}
      />
    )
  }

  return (
    <AuthLayout
      title="Connexion"
      footer={
        <div className="flex flex-col gap-1">
          <Link to="/forgot-password" className="underline">
            Mot de passe oublié ?
          </Link>
          <Link to="/sign-up" className="underline">
            Créer un compte
          </Link>
        </div>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <FormError message={serverError} />
        <TextField
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <SubmitButton pending={formState.isSubmitting}>Se connecter</SubmitButton>
      </form>
    </AuthLayout>
  )
}

/**
 * The second half. It holds the two ids and the code, never the password —
 * the first half is already spent, and `mfaId` is what ties them together.
 */
function SecondFactorForm({
  challenge,
  onSignedIn,
  onGiveUp,
}: {
  challenge: Challenge
  onSignedIn: () => Promise<unknown>
  onGiveUp: () => void
}) {
  const [otpId, setOtpId] = useState(challenge.otpId)
  const [code, setCode] = useState('')
  const [serverError, setServerError] = useState<string>()
  const [resent, setResent] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setServerError(undefined)
    setPending(true)
    try {
      await completeSignIn(otpId, code, challenge.mfaId)
      await onSignedIn()
    } catch {
      setServerError('Ce code est incorrect ou expiré.')
    } finally {
      setPending(false)
    }
  }

  /**
   * A code lives minutes, and fetching one's mail can take longer than that.
   * Without this, an expired code left only "back to sign-in" — which throws
   * the challenge away and makes the owner retype their password to be sent
   * another. The `mfaId` outlives the code, so the same challenge can carry a
   * second one.
   */
  const resend = async () => {
    setServerError(undefined)
    setResent(false)
    setPending(true)
    try {
      setOtpId(await requestSignInCode(challenge.email))
      setCode('')
      setResent(true)
    } catch {
      setServerError('Impossible d’envoyer un nouveau code. Réessayez dans un instant.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Code de connexion"
      footer={
        <button type="button" onClick={onGiveUp} className="underline">
          Revenir à la connexion
        </button>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="space-y-4"
        noValidate
      >
        <FormError message={serverError} />
        <p className="text-sm text-slate-600">
          Un code vient d’être envoyé à votre adresse e-mail. Il est valable quelques minutes.
        </p>
        {/* inputMode numeric and one-time-code: the keyboard opens on digits,
            and both iOS and Android offer the code straight from the message. */}
        <TextField
          label="Code reçu par e-mail"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {resent ? (
          <p role="status" className="text-sm text-slate-600">
            Un nouveau code vient d’être envoyé.
          </p>
        ) : null}
        <SubmitButton pending={pending}>Valider le code</SubmitButton>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={pending}
          className="w-full text-sm underline underline-offset-4 disabled:opacity-60"
        >
          Renvoyer un code
        </button>
      </form>
    </AuthLayout>
  )
}

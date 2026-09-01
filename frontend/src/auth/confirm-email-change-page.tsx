import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { TextField } from '@/components/text-field'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { AuthLayout } from './auth-layout.tsx'
import { confirmEmailChange } from './auth.ts'

/**
 * Where the link in the new address lands. The token is a prop read on every
 * render rather than form state, as on the reset screen: the route guarantees
 * it, and a fresh one must never be shadowed by a stale value caught at mount.
 *
 * The password is asked for because PocketBase asks for it — a token that
 * arrived in a mailbox is not on its own proof of who is holding it.
 */
export function ConfirmEmailChangePage({ token }: { token: string }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [serverError, setServerError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setServerError(undefined)
    setPending(true)
    try {
      await confirmEmailChange(token, password)
      // Confirming invalidates every session the account had, so the sign-in
      // screen is not a courtesy here, it is the only place left to go.
      await navigate({ to: '/sign-in' })
    } catch {
      setServerError('Ce lien est invalide ou expiré, ou le mot de passe est incorrect.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Confirmer votre adresse"
      footer={
        <Link to="/sign-in" className="underline">
          Revenir à la connexion
        </Link>
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
        <p className="text-sm text-muted">
          Saisissez votre mot de passe pour confirmer cette adresse. Vous devrez ensuite vous
          reconnecter avec elle.
        </p>
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <SubmitButton pending={pending}>Confirmer cette adresse</SubmitButton>
      </form>
    </AuthLayout>
  )
}

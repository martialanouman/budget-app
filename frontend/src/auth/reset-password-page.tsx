import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/text-field'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { AuthLayout } from './auth-layout.tsx'
import { confirmPasswordReset } from './auth.ts'
import { type ResetPasswordValues, resetPasswordSchema } from './auth-schemas.ts'

// The token stays a prop read on every render rather than form state: the route
// guarantees it is present, and a fresh one must never be shadowed by a stale
// value captured at mount.
export function ResetPasswordPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const { register, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = handleSubmit(async ({ password, passwordConfirm }) => {
    setServerError(undefined)
    try {
      await confirmPasswordReset(token, password, passwordConfirm)
      await navigate({ to: '/sign-in' })
    } catch {
      setServerError('Ce lien de réinitialisation est invalide ou expiré.')
    }
  })

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      footer={
        <Link to="/forgot-password" className="underline">
          Demander un nouveau lien
        </Link>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <FormError message={serverError} />
        <TextField
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          error={formState.errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
        />
        <SubmitButton pending={formState.isSubmitting}>Réinitialiser</SubmitButton>
      </form>
    </AuthLayout>
  )
}

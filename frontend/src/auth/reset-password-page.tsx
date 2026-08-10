import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/text-field'
import { AuthLayout, FormError, SubmitButton } from './auth-layout.tsx'
import { confirmPasswordReset } from './auth.ts'
import { type ResetPasswordValues, resetPasswordSchema } from './auth-schemas.ts'

export function ResetPasswordPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const { register, handleSubmit, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined)
    try {
      await confirmPasswordReset(values.token, values.password)
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
        <input type="hidden" {...register('token')} />
        <TextField
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={formState.errors.password?.message ?? formState.errors.token?.message}
          {...register('password')}
        />
        <SubmitButton pending={formState.isSubmitting}>Réinitialiser</SubmitButton>
      </form>
    </AuthLayout>
  )
}

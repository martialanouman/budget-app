import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/text-field'
import { AuthLayout, FormError, SubmitButton } from './auth-layout.tsx'
import { requestPasswordReset } from './auth.ts'
import { type ForgotPasswordValues, forgotPasswordSchema } from './auth-schemas.ts'

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string>()
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(undefined)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setServerError("Impossible d'envoyer le lien pour le moment.")
    }
  })

  return (
    <AuthLayout
      title="Mot de passe oublié"
      footer={
        <Link to="/sign-in" className="underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        // Deliberately not revealing whether the address exists.
        <p role="status" className="text-sm text-slate-700">
          Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.
        </p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <FormError message={serverError} />
          <TextField
            label="Adresse e-mail"
            type="email"
            autoComplete="email"
            error={formState.errors.email?.message}
            {...register('email')}
          />
          <SubmitButton pending={formState.isSubmitting}>Envoyer le lien</SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}

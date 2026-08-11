import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/text-field'
import { AuthLayout, FormError, SubmitButton } from './auth-layout.tsx'
import { SignedUpButNotSignedIn, signUp } from './auth.ts'
import { type SignUpValues, signUpSchema } from './auth-schemas.ts'

export function SignUpPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const { register, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = handleSubmit(async ({ email, password, passwordConfirm }) => {
    setServerError(undefined)
    try {
      await signUp(email, password, passwordConfirm)
      await navigate({ to: '/' })
    } catch (error) {
      setServerError(
        error instanceof SignedUpButNotSignedIn
          ? 'Votre compte a bien été créé, mais la connexion automatique a échoué. Connectez-vous.'
          : 'Impossible de créer le compte. Cette adresse est peut-être déjà utilisée.',
      )
    }
  })

  return (
    <AuthLayout
      title="Créer un compte"
      footer={
        <Link to="/sign-in" className="underline">
          J'ai déjà un compte
        </Link>
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
        <SubmitButton pending={formState.isSubmitting}>Créer mon compte</SubmitButton>
      </form>
    </AuthLayout>
  )
}

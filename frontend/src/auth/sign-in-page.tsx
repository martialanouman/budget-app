import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TextField } from '@/components/text-field'
import { AuthLayout, FormError, SubmitButton } from './auth-layout.tsx'
import { signIn } from './auth.ts'
import { type SignInValues, signInSchema } from './auth-schemas.ts'

export function SignInPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string>()
  const { register, handleSubmit, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(undefined)
    try {
      await signIn(email, password)
      await navigate({ to: '/' })
    } catch {
      setServerError('E-mail ou mot de passe incorrect.')
    }
  })

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

import { z } from 'zod'

// Mirrors the users collection migration; the server rejects anything shorter.
export const MIN_PASSWORD_LENGTH = 10

const email = z.email('Adresse e-mail invalide')

const newPassword = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
  )

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis'),
})

export const signUpSchema = z.object({
  email,
  password: newPassword,
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Lien de réinitialisation invalide'),
  password: newPassword,
})

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

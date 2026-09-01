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

const mismatch = {
  message: 'Les mots de passe ne correspondent pas',
  path: ['passwordConfirm'],
}

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis'),
})

export const signUpSchema = z
  .object({ email, password: newPassword, passwordConfirm: z.string() })
  .refine((values) => values.password === values.passwordConfirm, mismatch)

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, passwordConfirm: z.string() })
  .refine((values) => values.password === values.passwordConfirm, mismatch)

// The current password is only checked for presence: whether it is right is
// the server's to say, and a client that guessed would be wrong or telling.
export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Mot de passe actuel requis'),
    password: newPassword,
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, mismatch)

export const changeEmailSchema = z.object({ email })

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export type ChangeEmailValues = z.infer<typeof changeEmailSchema>

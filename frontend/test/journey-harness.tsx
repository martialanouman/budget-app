import { createMemoryHistory } from '@tanstack/react-router'
import { render } from 'vitest-browser-react'
import { signIn, signUp } from '@/auth/auth.ts'
import { pb } from '@/lib/pocketbase'
import { createQueryClient } from '@/lib/query-client'
import { AppRouterProvider, createAppRouter } from '@/router.tsx'

export const PASSWORD = 'motdepasse-solide'

let seq = 0

export const uniqueEmail = (prefix = 'user') => `${prefix}${Date.now()}-${++seq}@example.com`

/** Mounts the real application on an in-memory history, as a user would meet it. */
export async function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))
  const client = createQueryClient()
  const screen = await render(<AppRouterProvider router={router} client={client} />)

  return { screen, router, client }
}

/** Creates an account through the same path the sign-up screen uses. */
export async function createSignedInUser(prefix?: string) {
  const email = uniqueEmail(prefix)

  await signUp(email, PASSWORD, PASSWORD)

  return email
}

export async function signInAs(email: string) {
  await signIn(email, PASSWORD)
}

export const currentUserId = () => pb.authStore.record?.id

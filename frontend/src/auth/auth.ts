import { useSyncExternalStore } from 'react'
import { pb } from '@/lib/pocketbase'

const users = () => pb.collection('users')

// Thrown when the account exists but the automatic sign-in that follows did
// not: the caller must not tell the user their address is already taken.
export class SignedUpButNotSignedIn extends Error {
  constructor(cause: unknown) {
    super('Account created but automatic sign-in failed', { cause })
    this.name = 'SignedUpButNotSignedIn'
  }
}

export async function signUp(email: string, password: string, passwordConfirm: string) {
  await users().create({ email, password, passwordConfirm })

  try {
    await users().authWithPassword(email, password)
  } catch (cause) {
    throw new SignedUpButNotSignedIn(cause)
  }
}

export async function signIn(email: string, password: string) {
  await users().authWithPassword(email, password)
}

export function signOut() {
  pb.authStore.clear()
}

export async function requestPasswordReset(email: string) {
  await users().requestPasswordReset(email)
}

export async function confirmPasswordReset(
  token: string,
  password: string,
  passwordConfirm: string,
) {
  await users().confirmPasswordReset(token, password, passwordConfirm)

  // PocketBase rotates the record's tokenKey on password change, so any local
  // session is already dead server-side while still looking valid to the
  // guard. Drop it rather than let it bounce the user into the app.
  pb.authStore.clear()
}

const subscribe = (onStoreChange: () => void) => pb.authStore.onChange(onStoreChange)

const getSnapshot = () => pb.authStore.token

export function useAuth() {
  useSyncExternalStore(subscribe, getSnapshot)

  return {
    isAuthenticated: pb.authStore.isValid,
    email: pb.authStore.record?.email as string | undefined,
  }
}

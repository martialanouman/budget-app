import { useSyncExternalStore } from 'react'
import { pb } from '@/lib/pocketbase'

const users = () => pb.collection('users')

export async function signUp(email: string, password: string) {
  await users().create({ email, password, passwordConfirm: password })
  await users().authWithPassword(email, password)
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

export async function confirmPasswordReset(token: string, password: string) {
  await users().confirmPasswordReset(token, password, password)
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

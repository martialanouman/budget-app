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

/**
 * Raised when the password was right and a second factor is still owed. It
 * carries the `mfaId` that ties the two halves of the sign-in together, so the
 * screen can ask for the code without holding on to the password.
 */
export class SecondFactorRequired extends Error {
  readonly mfaId: string

  constructor(mfaId: string) {
    super('A second factor is required to finish signing in')
    this.name = 'SecondFactorRequired'
    this.mfaId = mfaId
  }
}

/**
 * PocketBase answers a password that is right but not sufficient with a 401
 * carrying an `mfaId` — the same status it uses for a password that is simply
 * wrong. Only the presence of that id separates the two, so a caller that
 * looked at the status alone would tell somebody their password was wrong when
 * it was not.
 */
export async function signIn(email: string, password: string) {
  try {
    await users().authWithPassword(email, password)
  } catch (cause) {
    const mfaId = (cause as { response?: { mfaId?: string } }).response?.mfaId

    if (!mfaId) throw cause

    throw new SecondFactorRequired(mfaId)
  }
}

/** Sends the one-time code, and returns the id the code has to be quoted with. */
export async function requestSignInCode(email: string) {
  return (await users().requestOTP(email)).otpId
}

export async function completeSignIn(otpId: string, code: string, mfaId: string) {
  await users().authWithOTP(otpId, code, { mfaId })
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

/**
 * Changing one's own password from inside the application. PocketBase demands
 * the current one on the record itself — the screen asks for it because the
 * server does, not merely as a courtesy.
 *
 * The same tokenKey rotation applies, so the session this was called from is
 * dead the moment it succeeds. Rather than throw somebody back to the sign-in
 * screen for having done an ordinary thing correctly, we sign them straight
 * back in with the password they just chose.
 */
export async function changePassword(current: string, password: string, passwordConfirm: string) {
  const record = pb.authStore.record

  if (!record) throw new Error('No account is signed in.')

  const email = record.email as string

  await users().update(record.id, { oldPassword: current, password, passwordConfirm })
  await users().authWithPassword(email, password)
}

/**
 * Asks for the address to be changed. Nothing changes yet: PocketBase mails a
 * token to the NEW address, and the change lands only once that token comes
 * back — which is what makes it proof the address exists and is reachable.
 */
export async function requestEmailChange(newEmail: string) {
  await users().requestEmailChange(newEmail)
}

export async function confirmEmailChange(token: string, password: string) {
  await users().confirmEmailChange(token, password)

  // Confirming invalidates every token the account had, this one included. The
  // store would otherwise hold a session the server has already forgotten,
  // and the guard cannot tell the difference.
  pb.authStore.clear()
}

/** The second factor, on or off, for this account alone (`options.mfa.rule`). */
export async function setSecondFactor(enabled: boolean) {
  const record = pb.authStore.record

  if (!record) throw new Error('No account is signed in.')

  await users().update(record.id, { mfa_enabled: enabled })
}

const subscribe = (onStoreChange: () => void) => pb.authStore.onChange(onStoreChange)

/**
 * The token and the name together, as one string.
 *
 * The token alone stopped being enough once the name reached the screen:
 * saving it refreshes the record without minting a new token, so React
 * compared two identical snapshots and re-rendered nothing — the name right in
 * the database and stale in the header. A string rather than an object,
 * because getSnapshot runs on every render and a fresh object each time would
 * loop forever.
 */
const getSnapshot = () =>
  `${pb.authStore.token}|${pb.authStore.record?.name ?? ''}|${pb.authStore.record?.mfa_enabled ?? ''}`

export function useAuth() {
  useSyncExternalStore(subscribe, getSnapshot)

  return {
    isAuthenticated: pb.authStore.isValid,
    email: pb.authStore.record?.email as string | undefined,
    name: pb.authStore.record?.name as string | undefined,
    mfaEnabled: Boolean(pb.authStore.record?.mfa_enabled),
  }
}

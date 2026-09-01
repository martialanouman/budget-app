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
 * Returns whether the session survived. It usually does: the tokenKey rotation
 * kills it, so we sign straight back in with the password just chosen rather
 * than throw somebody out for having done an ordinary thing correctly.
 *
 * It cannot survive for an account with a second factor, because the sign-in
 * that would restore it is the very call the factor intercepts, and no code is
 * in hand here to answer with. That case used to surface as
 * "le changement a échoué" over a password that had in fact been changed.
 *
 * Whatever the reason a re-authentication does not land — a second factor, a
 * dropped connection, the rate limiter — the store is emptied. The SDK writes
 * the updated record back beside the token the rotation has already killed,
 * and `authStore.isValid` reads only the JWT's expiry, so leaving it be would
 * park the owner inside an application answering 401 to everything.
 */
export async function changePassword(
  current: string,
  password: string,
  passwordConfirm: string,
): Promise<boolean> {
  const record = pb.authStore.record

  if (!record) throw new Error('No account is signed in.')

  const email = record.email as string

  await users().update(record.id, { oldPassword: current, password, passwordConfirm })

  try {
    await users().authWithPassword(email, password)

    return true
  } catch (cause) {
    pb.authStore.clear()

    // A second factor is not a failure — the password did change, and saying
    // otherwise is the lie this returns false to avoid. Anything else is.
    if ((cause as { response?: { mfaId?: string } }).response?.mfaId) return false

    throw cause
  }
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

/** Turning the second factor on: adding protection needs no proof of identity. */
export async function enableSecondFactor() {
  const record = pb.authStore.record

  if (!record) throw new Error('No account is signed in.')

  await users().update(record.id, { mfa_enabled: true })
}

/**
 * Turning it off does need proof, and the password is it.
 *
 * A single click on a live session removed the protection — which made the
 * toggle the weakest part of the very thing it guards: a borrowed phone or a
 * lifted token was enough, silently. The sibling address change in the same
 * screen demands the password at confirmation; this now matches it.
 *
 * The check is `authWithPassword`, so it is the server that says whether the
 * password is right. For an account that still has its second factor the call
 * comes back owing a code — which is not a failure here: it can only happen
 * once the password has been accepted, so it proves exactly what was asked.
 */
export async function disableSecondFactor(password: string) {
  const record = pb.authStore.record

  if (!record) throw new Error('No account is signed in.')

  const email = record.email as string

  try {
    await users().authWithPassword(email, password)
  } catch (cause) {
    if (!(cause as { response?: { mfaId?: string } }).response?.mfaId) throw cause
  }

  await users().update(record.id, { mfa_enabled: false })
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

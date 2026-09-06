import type { ReactNode } from 'react'
import { PRIMARY_BUTTON_CLASS } from './primary-button.ts'

export function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${PRIMARY_BUTTON_CLASS} bg-accent focus-visible:ring-accent/40`}
    >
      {children}
    </button>
  )
}

/**
 * The border is what separates it from the closing section of the account
 * screen, which is `bg-danger-soft` itself: without one, an error raised there
 * was exactly the colour of the card it appeared in, and read as one more
 * paragraph rather than as the thing that had just gone wrong.
 */
export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null

  return (
    <p
      role="alert"
      className="rounded-field border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  )
}

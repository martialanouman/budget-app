import type { ReactNode } from 'react'

export function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 w-full rounded-full bg-accent px-4 py-2.5 text-base font-semibold text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null

  return (
    <p role="alert" className="rounded-field bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  )
}

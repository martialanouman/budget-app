import type { ReactNode } from 'react'

export function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

export function FormError({ message }: { message: string | undefined }) {
  if (!message) return null

  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}

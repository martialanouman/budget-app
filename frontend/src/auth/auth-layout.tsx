import type { ReactNode } from 'react'

export function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {children}
        {footer ? <div className="text-sm text-muted">{footer}</div> : null}
      </div>
    </main>
  )
}

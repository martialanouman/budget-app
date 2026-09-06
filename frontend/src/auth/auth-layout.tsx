import type { ReactNode } from 'react'

/**
 * The frame the six signed-out screens share.
 *
 * The card carries the refonte's own shape now — `not-found-page` is the same
 * centred card and had it from the first PR, while this one kept 8px corners
 * and a flat shadow through five more.
 *
 * The wordmark is what was actually missing. "Kalpe" reaches the rail and the
 * browser tab, and both of those are behind the sign-in screen: somebody who
 * has not signed in yet never meets the name of the thing they are signing in
 * to. It sits outside the card, where a mark belongs and where it stays out of
 * the form's own reading order.
 */
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
      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-2xl font-semibold text-ink">Kalpe</p>
        <div className="space-y-6 rounded-card border border-line bg-surface p-6 shadow-card">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {children}
          {footer ? <div className="text-sm text-muted">{footer}</div> : null}
        </div>
      </div>
    </main>
  )
}

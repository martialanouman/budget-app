import { type ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'

/**
 * A destination the navigation names but the application does not answer yet.
 *
 * The entry exists before the feature on purpose (§8 of the functional specs):
 * a tab bar that hides what is coming lets someone conclude the product does
 * not do savings at all, and the address they were sent answers "Page
 * introuvable" — which reads as a broken link rather than as work in progress.
 *
 * What it must not be is the word "Bientôt" alone. A waiting screen says which
 * requirement is coming, and points at whatever answers part of the need today
 * — otherwise it costs a tap and returns nothing.
 */
export function WaitingPage({
  title,
  lead,
  coming,
  children,
}: {
  title: string
  lead: string
  coming: readonly string[]
  children?: ReactNode
}) {
  return (
    <AppShell title={title}>
      <div className="space-y-4 rounded-card border border-line bg-surface p-4">
        <p className="text-ink">{lead}</p>
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Ce qui est prévu</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {coming.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {children}
      </div>
    </AppShell>
  )
}

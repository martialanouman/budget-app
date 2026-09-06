import { type ReactNode } from 'react'

/**
 * One group of the account screen.
 *
 * They were hand-written `<section>` tags spread over two files, and the shape
 * had already drifted: five sat flat on the page background while every other
 * screen of the application groups into a card, and the sixth — the dangerous
 * one — carried the pre-refonte 6px corner beside cards with 20. Seven now, so
 * the drift had somewhere left to go.
 *
 * `danger` is the closing group and only ever that one. A boolean rather than a
 * tone name because there are two answers and there is no third: what makes a
 * group dangerous here is that it destroys the account.
 */
export function SettingsSection({
  title,
  danger = false,
  children,
}: {
  title: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={`space-y-3 rounded-card border p-4 ${
        danger ? 'border-danger bg-danger-soft' : 'border-line bg-surface'
      }`}
    >
      <h2 className={`text-lg font-medium ${danger ? 'text-danger' : 'text-ink'}`}>{title}</h2>
      {children}
    </section>
  )
}

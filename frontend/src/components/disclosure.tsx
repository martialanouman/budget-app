import { type ReactNode } from 'react'

/**
 * A creation form folded away above the list it feeds.
 *
 * Left open, a five-field form is a screenful a returning user crosses every
 * time to reach what they came for. The heading stays a heading — it moves
 * inside the `<summary>` rather than disappearing — so the outline of the page
 * is unchanged for anyone reading it through headings.
 */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="rounded-md border border-slate-200 bg-white">
      <summary className="flex min-h-11 cursor-pointer items-center px-3">
        <h2 className="text-lg font-medium">{summary}</h2>
      </summary>
      <div className="border-t border-slate-200 p-3">{children}</div>
    </details>
  )
}

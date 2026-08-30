/**
 * The shape of the list that is coming, while it is coming.
 *
 * "Chargement…" told the reader nothing about what to expect and made the page
 * jump when the rows arrived. The skeleton is hidden from assistive technology
 * — it carries no information — and the word is announced once instead.
 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
      <p className="sr-only">Chargement…</p>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden="true" className="flex items-center gap-3 p-3">
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-100" />
          </span>
          <span className="block h-4 w-20 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

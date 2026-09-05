import { useId } from 'react'
import { Flame } from 'lucide-react'

/**
 * RAP-06 on screen: the run of consecutive days carrying an entry.
 *
 * A lucide icon rather than an emoji, deliberately — emoji belong to the
 * categories, where the user chose them, and one here would read as a second
 * kind of thing.
 *
 * "Aucune série en cours" is a claim about the data, so it waits for the data.
 * Same policy as the three figures above it: nothing is asserted before it has
 * been read.
 */
export function StreakCard({
  run,
  pending,
}: {
  run: { days: number; holdsToday: boolean } | undefined
  pending: boolean
}) {
  const labelId = useId()

  return (
    <section
      aria-labelledby={labelId}
      className="flex items-center gap-3 rounded-md border border-line bg-surface p-3"
    >
      <Flame
        aria-hidden="true"
        size={22}
        strokeWidth={1.75}
        className={run ? 'shrink-0 text-accent' : 'shrink-0 text-muted'}
      />
      <div className="min-w-0">
        <h2 id={labelId} className="text-sm font-medium text-muted">
          Série de saisie
        </h2>
        {pending ? (
          <p>
            <span className="sr-only">Chargement…</span>
            <span
              aria-hidden="true"
              className="block h-6 w-40 animate-pulse rounded bg-surface-2"
            />
          </p>
        ) : run ? (
          <p className="font-medium text-ink">
            {run.days} jour{run.days > 1 ? 's' : ''} d’affilée
          </p>
        ) : (
          <p className="font-medium text-ink">Aucune série en cours</p>
        )}
        {run && !run.holdsToday ? (
          <p className="text-sm text-muted">Saisissez aujourd’hui pour la garder.</p>
        ) : null}
      </div>
    </section>
  )
}

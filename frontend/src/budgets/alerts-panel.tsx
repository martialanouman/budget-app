import { type Category, type Notification } from '@/lib/collections'
import { monthLabel } from '@/lib/dates.ts'

const THRESHOLD_LABELS: Record<number, string> = {
  80: 'seuil de 80 % atteint',
  100: 'plafond dépassé',
}

export function AlertsPanel({
  alerts,
  categories,
  onDismiss,
}: {
  alerts: Notification[]
  categories: Category[]
  onDismiss: (id: string) => void
}) {
  const nameOf = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? 'Catégorie supprimée'

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Alertes</h2>

      {alerts.length === 0 ? <p>Aucune alerte.</p> : null}

      <ul className="space-y-2">
        {alerts.map((alert) => {
          const wording = `${nameOf(alert.payload.category)} · ${
            THRESHOLD_LABELS[alert.payload.threshold] ?? 'seuil atteint'
          } en ${monthLabel(alert.payload.month)}`

          return (
            <li
              key={alert.id}
              className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3"
            >
              <span className="flex-1 text-sm text-amber-900">{wording}</span>
              {/* The visible label stays short; the accessible name carries
                  the whole alert, so several buttons never read alike. */}
              <button
                type="button"
                onClick={() => onDismiss(alert.id)}
                aria-label={`Marquer comme lue : ${wording}`}
                className="rounded-md border border-amber-400 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-700/40"
              >
                Marquer comme lue
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

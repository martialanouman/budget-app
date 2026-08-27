import { formatAmount, toMoney } from '@budget/domain'
import { type Category, type Notification } from '@/lib/collections'
import { monthLabel } from '@/lib/dates.ts'

const THRESHOLDS: Record<number, string> = {
  80: 'seuil de 80 % atteint',
  100: 'plafond dépassé',
}

/**
 * NOT-04, in-app side. One place words every kind of notification, so the
 * budgets screen and the dashboard can never phrase the same alert
 * differently.
 */
export function wordingOf(notification: Notification, categories: Category[]): string {
  if (notification.type === 'depassement_budget') {
    const name =
      categories.find((category) => category.id === notification.payload.category)?.name ??
      'Catégorie supprimée'

    return `${name} · ${THRESHOLDS[notification.payload.threshold] ?? 'seuil atteint'} en ${monthLabel(notification.payload.month)}`
  }

  if (notification.type === 'echeance_dette') {
    const { creditor, direction, dueDate, daysAhead, amount } = notification.payload
    const when =
      daysAhead === 0 ? "aujourd'hui" : `dans ${daysAhead} jour${daysAhead > 1 ? 's' : ''}`
    const who = direction === 'je_dois' ? 'à payer' : 'à recevoir'

    return `${creditor} · ${formatAmount(toMoney(amount))} ${who} le ${dueDate}, ${when}`
  }

  return 'Notification'
}

export function NotificationCentre({
  notifications,
  categories,
  ready,
  onDismiss,
  title = 'Alertes',
}: {
  notifications: Notification[]
  categories: Category[]
  /** The categories have to be in before a name can be claimed missing. */
  ready: boolean
  onDismiss: (id: string) => void
  title?: string
}) {
  if (!ready) return null

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>

      {notifications.length === 0 ? <p>Aucune alerte.</p> : null}

      <ul className="space-y-2">
        {notifications.map((notification) => {
          const wording = wordingOf(notification, categories)

          return (
            <li
              key={notification.id}
              className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3"
            >
              <span className="flex-1 text-sm text-amber-900">{wording}</span>
              {/* Short label, full accessible name: several buttons on the
                  page would otherwise read alike. */}
              <button
                type="button"
                onClick={() => onDismiss(notification.id)}
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

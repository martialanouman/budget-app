import { daysUntil, formatAmount, toMoney } from '@budget/domain'
import { type Category, type Notification } from '@/lib/collections'
import { dayLabel, monthLabel, todayLocally } from '@/lib/dates.ts'

const THRESHOLDS: Record<number, string> = {
  80: 'seuil de 80 % atteint',
  100: 'plafond dépassé',
}

const plural = (days: number) => (days > 1 ? 's' : '')

/**
 * NOT-04, in-app side. One place words every kind of notification, so the
 * budgets screen and the dashboard can never phrase the same alert
 * differently.
 *
 * Undefined means "nothing that can be said": the categories a budget alert
 * names are not in yet, or the type has no wording at all. A card reading
 * "Notification" tells the reader strictly nothing and still asks to be
 * dismissed.
 *
 * `categories` is the query's data, undefined while it is pending or failed —
 * so a debt reminder still shows when the categories cannot be read.
 */
export function wordingOf(
  notification: Notification,
  categories: Category[] | undefined,
  today = todayLocally(),
): string | undefined {
  if (notification.type === 'depassement_budget') {
    if (!categories) return undefined

    const name =
      categories.find((category) => category.id === notification.payload.category)?.name ??
      'Catégorie supprimée'

    return `${name} · ${THRESHOLDS[notification.payload.threshold] ?? 'seuil atteint'} en ${monthLabel(notification.payload.month)}`
  }

  if (notification.type === 'echeance_dette') {
    const { creditor, direction, dueDate, amount } = notification.payload
    // Counted against today, not read back from the payload: the reminder was
    // written on the morning the cron ran, and a card saying "in 3 days" three
    // days later is worse than no card.
    const days = daysUntil(today, dueDate)
    const when =
      days === 0
        ? "aujourd'hui"
        : days < 0
          ? `en retard de ${-days} jour${plural(-days)}`
          : `dans ${days} jour${plural(days)}`
    const who = direction === 'je_dois' ? 'à payer' : 'à recevoir'

    return `${creditor} · ${formatAmount(toMoney(amount))} ${who} le ${dayLabel(dueDate)}, ${when}`
  }

  return undefined
}

export function NotificationCentre({
  notifications,
  categories,
  ready,
  onDismiss,
  title = 'Alertes',
}: {
  notifications: Notification[]
  /** Undefined until the categories are in; only budget alerts need them. */
  categories: Category[] | undefined
  /** The notifications themselves have to be in before "none" can be said. */
  ready: boolean
  onDismiss: (id: string) => void
  title?: string
}) {
  if (!ready) return null

  const worded = notifications.flatMap((notification) => {
    const wording = wordingOf(notification, categories)

    return wording ? [{ notification, wording }] : []
  })

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>

      {worded.length === 0 ? <p>Aucune alerte.</p> : null}

      <ul className="space-y-2">
        {worded.map(({ notification, wording }) => (
          <li
            key={notification.id}
            className="flex items-center gap-3 rounded-md border border-warning bg-warning-soft p-3"
          >
            <span className="flex-1 text-sm text-warning">{wording}</span>
            {/* Short label, full accessible name: several buttons on the
                page would otherwise read alike. */}
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              aria-label={`Marquer comme lue : ${wording}`}
              className="min-h-11 rounded-md border border-warning px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-warning/40"
            >
              Marquer comme lue
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

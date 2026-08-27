import { formatAmount, toMoney } from '@budget/domain'
import { type BudgetSpending, type Category } from '@/lib/collections'

const TOP = 5

/**
 * RAP-02's breakdown, as a ranked bar list rather than a pie.
 *
 * A pie asks the reader to compare angles, which is the hardest comparison
 * there is, and needs a text alternative to pass WCAG anyway. Ranked bars are
 * read in one pass on a phone, carry their own figures, and cost no charting
 * dependency. The twelve-month curves of RAP-02 are another matter — they are
 * out of scope here, and that is where a chart library will earn its place.
 */
export function SpendingBreakdown({
  spending,
  categories,
}: {
  spending: BudgetSpending[]
  categories: Category[]
}) {
  const ranked = [...spending].sort((a, b) => b.spent - a.spent).slice(0, TOP)
  const largest = ranked[0]?.spent ?? 0

  const nameOf = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? 'Sans catégorie'

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Où part l’argent ce mois-ci</h2>

      {ranked.length === 0 ? <p>Aucune dépense ce mois-ci.</p> : null}

      <ul className="space-y-2">
        {ranked.map((row) => (
          <li key={row.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span>{nameOf(row.category)}</span>
              <span className="text-sm tabular-nums text-slate-600">
                {formatAmount(toMoney(row.spent))}
              </span>
            </div>
            {/* The figure sits beside the bar rather than inside it: the bar is
                a comparison, not the information. */}
            <div className="h-2 w-full rounded-full bg-slate-200" aria-hidden="true">
              <div
                className="h-2 rounded-full bg-slate-900"
                style={{ width: `${largest === 0 ? 0 : Math.round((row.spent * 100) / largest)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

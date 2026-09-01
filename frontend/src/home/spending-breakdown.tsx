import { formatAmount, toMoney } from '@budget/domain'
import { Meter } from '@/components/meter'
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
  ready,
}: {
  spending: BudgetSpending[]
  categories: Category[]
  /** "No spending" is a claim, and it needs the figures to be in first. */
  ready: boolean
}) {
  const ranked = [...spending].sort((a, b) => b.spent - a.spent).slice(0, TOP)
  const largest = ranked[0]?.spent ?? 0

  const nameOf = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? 'Sans catégorie'

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Où part l’argent ce mois-ci</h2>

      {ready && ranked.length === 0 ? <p>Aucune dépense ce mois-ci.</p> : null}

      <ul className="space-y-2">
        {ranked.map((row) => (
          <li key={row.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span>{nameOf(row.category)}</span>
              <span className="text-sm tabular-nums text-muted">
                {formatAmount(toMoney(row.spent))}
              </span>
            </div>
            {/* The figure sits beside the bar rather than inside it: the bar is
                a comparison, not the information. */}
            <Meter value={row.spent} max={largest} label={`Part de ${nameOf(row.category)}`} />
          </li>
        ))}
      </ul>
    </section>
  )
}

import { formatAmount, toMoney } from '@budget/domain'
import { useId } from 'react'
import { Ellipsis } from 'lucide-react'
import { type Hue, hueClass, hueOf, huePaint, iconOf } from '@/lib/appearance'
import { type BudgetSpending, type Category } from '@/lib/collections'

const TOP = 5

/** A circle whose circumference is 100, so a dash length is a percentage as written. */
const RADIUS = 15.9155

/** Twelve o'clock. SVG strokes start at three, and a ring read from the right reads wrong. */
const START = 25

type Slice = {
  key: string
  label: string
  icon: string | undefined
  hue: Hue | undefined
  amount: number
  share: number
}

/**
 * RAP-02's breakdown: a ring, and beside it an ordered legend that carries the
 * reading.
 *
 * The legend is not a caption for the ring — it is the other way round.
 * Comparing angles is the hardest comparison there is, so nothing here asks
 * anyone to: the figures are written out, largest first, each with its share.
 * The ring is hidden from assistive technology because everything it draws is
 * already in the list, and an exposed shape with no reading would only be a
 * second thing to skip past.
 *
 * What the ring does add is the tie to the rest of the application: an arc is
 * drawn in the hue its category wears everywhere else (CAT-04), so a colour
 * seen here is recognised on the categories screen without reading a word.
 *
 * Everything past the top five is one slice. Five rows is what a phone reads at
 * a glance, but a ring that showed five of eight categories would claim to say
 * where the money went while leaving part of it out.
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
  const labelId = useId()
  const spent = spending.filter((row) => row.spent > 0)
  const total = spent.reduce((sum, row) => sum + row.spent, 0)

  const ranked = [...spent].sort((a, b) => b.spent - a.spent)
  const rest = ranked.slice(TOP).reduce((sum, row) => sum + row.spent, 0)

  const categoryOf = (id: string) => categories.find((category) => category.id === id)

  const slices: Slice[] = ranked.slice(0, TOP).map((row) => {
    const category = categoryOf(row.category)
    const name = category?.name ?? 'Sans catégorie'

    return {
      key: row.id,
      label: name,
      icon: iconOf(category?.icon),
      hue: hueOf(category?.color, name),
      amount: row.spent,
      share: total === 0 ? 0 : (row.spent / total) * 100,
    }
  })

  if (rest > 0) {
    // "Autres catégories" rather than "Autres": one of the categories seeded at
    // sign-up is literally named "Autre", and the two sat in the same list
    // telling nobody apart. Found by an existing journey, not by reading.
    //
    // No hue either: this is not a category, and one of the eight would make it
    // look like a peer of the rows above it.
    slices.push({
      key: 'rest',
      label: 'Autres catégories',
      icon: undefined,
      hue: undefined,
      amount: rest,
      share: (rest / total) * 100,
    })
  }

  return (
    <section aria-labelledby={labelId} className="space-y-3">
      <h2 id={labelId} className="text-lg font-medium">
        Où part l’argent ce mois-ci
      </h2>

      {ready && slices.length === 0 ? <p>Aucune dépense ce mois-ci.</p> : null}

      {slices.length > 0 ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Ring slices={slices} />
          <ol
            aria-label="Répartition des dépenses"
            className="w-full min-w-0 flex-1 divide-y divide-line rounded-md border border-line bg-surface"
          >
            {slices.map((slice) => (
              <li key={slice.key} className="flex items-center gap-3 p-3">
                <span
                  aria-hidden="true"
                  className={`grid size-9 shrink-0 place-items-center rounded-field text-lg ${
                    slice.hue ? hueClass(slice.hue) : 'bg-surface-2'
                  }`}
                >
                  {/* The aggregate has no icon of its own, and an empty swatch
                      in a column of full ones reads as a defect rather than as
                      a remainder. */}
                  {slice.icon ?? <Ellipsis size={18} strokeWidth={2} className="text-muted" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                <span className="shrink-0 text-right">
                  <span className="block tabular-nums">{formatAmount(toMoney(slice.amount))}</span>
                  <span className="block text-sm tabular-nums text-muted">
                    {Math.round(slice.share)} %
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}

/** Decoration, and it says so: every figure it draws is in the legend beside it. */
function Ring({ slices }: { slices: Slice[] }) {
  // Each arc starts where the ones before it ended. Accumulated up front rather
  // than in the map: the compiler refuses a variable reassigned inside a render
  // callback, and six slices make the repeated sum free.
  const offsets = slices.map(
    (_, index) => START - slices.slice(0, index).reduce((sum, one) => sum + one.share, 0),
  )

  return (
    <svg viewBox="0 0 42 42" aria-hidden="true" className="size-36 shrink-0">
      <circle cx="21" cy="21" r={RADIUS} fill="none" stroke="var(--k-line)" strokeWidth="5" />
      {slices.map((slice, index) => (
        <circle
          key={slice.key}
          cx="21"
          cy="21"
          r={RADIUS}
          fill="none"
          data-hue={slice.hue}
          stroke={slice.hue ? huePaint(slice.hue) : 'var(--k-line-strong)'}
          strokeWidth="5"
          strokeDasharray={`${slice.share} ${100 - slice.share}`}
          strokeDashoffset={offsets[index]}
        />
      ))}
    </svg>
  )
}

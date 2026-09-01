/**
 * One progress bar for the whole application.
 *
 * `<progress>` was used on the budget envelopes and hand-built divs on the
 * dashboard breakdown, so the same idea looked different on two screens — and
 * the native element renders differently again on Safari iOS and Chrome
 * Android, and cannot be given the colour of the threshold it has crossed.
 *
 * The bar itself is decoration: it carries no figure a reader could not get
 * from the text beside it, and the value is announced through `aria-label` on
 * the wrapper rather than drawn from the pixels.
 *
 * The three tones are palette tokens, so they follow the theme. `neutral` is
 * the accent rather than a green: this bar also draws a category's share of
 * the month's spending, where green would congratulate somebody for having
 * spent.
 */
export function Meter({
  value,
  max,
  tone = 'neutral',
  label,
}: {
  value: number
  max: number
  tone?: 'neutral' | 'warning' | 'over'
  label: string
}) {
  const filled = max <= 0 ? 0 : Math.min(100, Math.round((value * 100) / max))
  const colour = tone === 'over' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-accent'

  return (
    <div
      role="img"
      aria-label={`${label} : ${filled} %`}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        aria-hidden="true"
        className={`h-2 rounded-full ${colour}`}
        style={{ width: `${filled}%` }}
      />
    </div>
  )
}

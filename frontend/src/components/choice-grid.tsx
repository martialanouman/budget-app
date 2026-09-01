import { type InputHTMLAttributes, type ReactNode, useId } from 'react'

/**
 * A grid of visual choices — an emoji, a colour — behind native radio inputs.
 *
 * Native, because a radio group already answers the arrow keys, already tells a
 * screen reader how many options there are and which is the current one, and
 * already works inside a form. Rebuilding that on buttons is where accessible
 * pickers usually go wrong, and it would buy nothing here.
 *
 * The input is hidden from sight but not from the accessibility tree, so it
 * keeps its focus ring — drawn on the label through `has-focus-visible`,
 * because the box the eye follows is the swatch, not the input.
 */
export function ChoiceGrid({
  legend,
  options,
  ...radio
}: {
  legend: string
  options: readonly { value: string; label: string; swatch: ReactNode }[]
} & InputHTMLAttributes<HTMLInputElement>) {
  const name = useId()

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex size-11 cursor-pointer items-center justify-center rounded-field border border-line-strong bg-surface has-checked:border-accent has-checked:ring-2 has-checked:ring-accent/30 has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
          >
            <input
              type="radio"
              className="sr-only"
              value={option.value}
              aria-label={option.label}
              {...radio}
              name={radio.name ?? name}
            />
            {option.swatch}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

import { type InputHTMLAttributes, type ReactNode, useId } from 'react'

/**
 * A grid of visual choices — an emoji, a colour — behind native radio inputs.
 *
 * Native, because a radio group already answers the arrow keys, already tells a
 * screen reader how many options there are and which is the current one, and
 * already works inside a form. Rebuilding that on buttons is where accessible
 * pickers usually go wrong, and it would buy nothing here.
 *
 * The input is invisible but not hidden from the accessibility tree, and it
 * covers the whole swatch rather than being clipped to a corner of it: the box
 * that receives the tap is then the box the eye follows, instead of a 1x1
 * target that only works because the label delegates to it. The focus ring is
 * drawn on the label through `has-focus-visible`, for the same reason.
 *
 * Nothing is selected until someone selects something. A pre-checked option is
 * an answer nobody gave, and here it would have painted every category the
 * same colour (CAT-04, CPT-02): what is left unchosen is derived from the name.
 * `hint` is what says so, and it describes the group rather than sitting loose
 * inside it — an empty grid with no explanation reads as a forgotten field, and
 * a paragraph a screen reader only meets by walking past it explains nothing to
 * someone who arrived on a radio.
 */
export function ChoiceGrid({
  legend,
  hint,
  options,
  ...radio
}: {
  legend: string
  hint?: string
  options: readonly { value: string; label: string; swatch: ReactNode }[]
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'aria-label'>) {
  const name = useId()
  const hintId = useId()

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex size-11 cursor-pointer items-center justify-center rounded-field border border-line-strong bg-surface has-checked:border-accent has-checked:ring-2 has-checked:ring-accent/30 has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
          >
            <input
              {...radio}
              type="radio"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={option.value}
              aria-label={option.label}
              name={radio.name ?? name}
            />
            {option.swatch}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

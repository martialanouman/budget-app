import { type ReactNode, useId } from 'react'

/**
 * The label, the error and the wiring between them — everything a field has
 * apart from the control itself.
 *
 * `text-field` and `select-field` were word-for-word twins but for one
 * `bg-surface`, so a change to the error markup had to be made twice and, twice,
 * was not. The control is rendered through a callback rather than cloned, so
 * the caller keeps its own element type and props.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string
  error: string | undefined
  children: (props: {
    id: string
    'aria-invalid': true | undefined
    'aria-describedby': string | undefined
  }) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Shared by both controls. `min-h-11` is the 44px touch target the rest of the
 * interface already holds to; the fields were the one place that did not.
 */
export const CONTROL_CLASS =
  'min-h-11 rounded-field border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 aria-invalid:border-danger'

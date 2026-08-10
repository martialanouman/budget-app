import { type InputHTMLAttributes, useId } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | undefined
}

export function TextField({ label, error, ...input }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 aria-invalid:border-red-600"
        {...input}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

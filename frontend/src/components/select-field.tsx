import type { SelectHTMLAttributes } from 'react'
import { CONTROL_CLASS, Field } from './field.tsx'

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: readonly { value: string; label: string }[]
  error?: string | undefined
}

export function SelectField({ label, options, error, ...select }: SelectFieldProps) {
  return (
    <Field label={label} error={error}>
      {(wiring) => (
        <select {...wiring} className={CONTROL_CLASS} {...select}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

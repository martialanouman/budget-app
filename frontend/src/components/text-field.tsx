import type { InputHTMLAttributes } from 'react'
import { CONTROL_CLASS, Field } from './field.tsx'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | undefined
}

export function TextField({ label, error, ...input }: TextFieldProps) {
  return (
    <Field label={label} error={error}>
      {(wiring) => <input {...wiring} className={CONTROL_CLASS} {...input} />}
    </Field>
  )
}

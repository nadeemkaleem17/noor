import { Field as BaseField } from '@base-ui/react/field'
import type { ReactNode } from 'react'
import { cn } from '../cn'

type Props = {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Shows the asterisk. Also pass `required` to the control so the browser and screen readers know. */
  required?: boolean
  disabled?: boolean
  name?: string
  className?: string
  children: ReactNode
}

/** Label, control, hint and error wired together: `htmlFor`, `aria-describedby` and `aria-invalid` are set for the control inside. */
export function Field({ label, hint, error, required, disabled, name, className, children }: Props) {
  return (
    <BaseField.Root name={name} disabled={disabled} invalid={Boolean(error)} className={cn('flex flex-col gap-1.5', className)}>
      <BaseField.Label className="text-sm font-medium text-fg">
        {label}
        {required ? <span aria-hidden className="ms-0.5 text-danger">{'*'}</span> : null}
      </BaseField.Label>
      {children}
      {hint ? <BaseField.Description className="text-sm text-muted">{hint}</BaseField.Description> : null}
      <BaseField.Error match={Boolean(error)} className="text-sm text-danger">
        {error}
      </BaseField.Error>
    </BaseField.Root>
  )
}

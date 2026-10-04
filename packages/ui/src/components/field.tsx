import { Field as BaseField } from '@base-ui/react/field'
import type { ReactNode } from 'react'
import { Controller, type Control, type ControllerRenderProps, type FieldPath, type FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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

type RHFFieldProps<T extends FieldValues, N extends FieldPath<T>> = Omit<Props, 'children' | 'error' | 'name'> & {
  control: Control<T>
  name: N
  /** Gets the field's props (value, onChange, onBlur, ref, name) plus `invalid`: `{(field) => <Input {...field} />}`. */
  children: (field: ControllerRenderProps<T, N> & { invalid: boolean }) => ReactNode
}

/** `Field` + react-hook-form `Controller`. The error message is a code (`required`, `phone_invalid`) and is translated here; an unknown code reads as a generic error. */
export function RHFField<T extends FieldValues, N extends FieldPath<T>>({ control, name, children, ...field }: RHFFieldProps<T, N>) {
  const { t, i18n } = useTranslation('errors')
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: controlled, fieldState }) => {
        const code = fieldState.error?.message
        const error = code ? (i18n.exists(code, { ns: 'errors' }) ? t(code) : t('unknown')) : undefined
        return (
          <Field {...field} error={error}>
            {children({ ...controlled, invalid: fieldState.invalid })}
          </Field>
        )
      }}
    />
  )
}

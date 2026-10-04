import { Field as BaseField } from '@base-ui/react/field'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'

/**
 * @typedef {object} Props
 * @property {import('react').ReactNode} label
 * @property {import('react').ReactNode} [hint]
 * @property {import('react').ReactNode} [error]
 * @property {boolean} [required] - Shows the asterisk. Also pass `required` to the control so the browser and screen readers know.
 * @property {boolean} [disabled]
 * @property {string} [name]
 * @property {string} [className]
 * @property {import('react').ReactNode} children
 */

/**
 * Label, control, hint and error wired together: `htmlFor`, `aria-describedby` and `aria-invalid` are set for the control inside.
 * @param {Props} props
 */
export function Field({ label, hint, error, required, disabled, name, className, children }) {
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

/**
 * @template {import('react-hook-form').FieldValues} T
 * @template {import('react-hook-form').FieldPath<T>} N
 * @typedef {Omit<Props, 'children' | 'error' | 'name'> & {
 * control: import('react-hook-form').Control<T>;
 * name: N;
 * children: (field: import('react-hook-form').ControllerRenderProps<T, N> & { invalid: boolean; }) => import('react').ReactNode;
 * }} RHFFieldProps
 */

/**
 * `Field` + react-hook-form `Controller`. The error message is a code (`required`, `phone_invalid`) and is translated here; an unknown code reads as a generic error.
 * @template {import('react-hook-form').FieldValues} T
 * @template {import('react-hook-form').FieldPath<T>} N
 * @param {RHFFieldProps<T, N>} props
 */
export function RHFField({ control, name, children, ...field }) {
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

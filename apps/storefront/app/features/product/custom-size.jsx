import { useTranslation } from 'react-i18next'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { Textarea } from '@noor/ui/textarea'

/** @typedef {import('@noor/contract').CustomSizeForm} FormSchema */

/**
 * The measurements of a made-to-measure size (plan/06-storefront/04-pdp.md section 7), drawn from the form the product names. The fields are part of the add-to-cart form (`m.<key>`,
 * and `notes`), so they travel with the line and nothing is lost while the size chart is open. The API checks every answer again against the same form.
 * Shown inline under the size rather than in a drawer of its own: the choice and the measurements stay in view together.
 * @param {{ schema: FormSchema, errors?: boolean }} props
 */
export function CustomSize({ schema, errors }) {
  const { t } = useTranslation('storefront')
  return (
    <fieldset className="flex flex-col gap-4 rounded-card border border-line-strong p-4">
      <legend className="px-1 font-medium">{schema.title ?? t('pdp.custom.title')}</legend>
      {errors ? <p role="alert" className="text-sm text-danger">{t('pdp.custom.check')}</p> : null}
      {schema.fields.map((f) => {
        const name = `m.${f.key}`
        const label = f.unit ? `${f.label} (${t(`pdp.units.${f.unit}`)})` : f.label
        return (
          <Field key={f.key} label={label} required={f.required} {...(f.helpText ? { hint: f.helpText } : {})}>
            {f.type === 'select' ? (
              <NativeSelect name={name} required={f.required} placeholder={t('pdp.choose')} options={f.options ?? []} />
            ) : f.type === 'textarea' ? (
              <Textarea name={name} required={f.required} />
            ) : (
              <Input name={name} required={f.required} type={f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'} {...(f.type === 'number' ? { inputMode: /** @type {const} */ ('decimal'), step: f.step ?? 'any', ...(f.min !== undefined ? { min: f.min } : {}), ...(f.max !== undefined ? { max: f.max } : {}) } : {})} />
            )}
          </Field>
        )
      })}
      {schema.allowNotes ? (
        <Field label={t('pdp.custom.notes')}>
          <Textarea name="notes" maxLength={500} />
        </Field>
      ) : null}
    </fieldset>
  )
}

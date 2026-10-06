import { useTranslation } from 'react-i18next'
import { NativeSelect } from '@noor/ui/native-select'
import { Dot } from '../catalog/product-card'
import { valueSoldOut } from '~/lib/selection'

/** @typedef {import('~/lib/selection').Option} Option */
/** @typedef {import('~/lib/selection').Variant} Variant */
/** @typedef {import('~/lib/selection').Chosen} Chosen */

/**
 * One option of a product (plan/06-storefront/04-pdp.md section 4): native radios drawn as chips, so choosing works without JavaScript, or a native select. A value that is sold out
 * (given the other choices) is struck through and marked `aria-disabled`, but it can still be reached and chosen: choosing it says "Sold out in M" and offers to notify.
 * The group takes focus when the visitor presses "Select a size" (`groupRef`).
 * @param {object} props
 * @param {Option} props.option
 * @param {Variant[]} props.variants
 * @param {Chosen} props.chosen
 * @param {(optionId: string, valueId: string) => void} props.onChoose
 * @param {import('react').Ref<HTMLFieldSetElement>} [props.groupRef]
 * @param {string} [props.name] form field prefix, `opt` for the product, `bundle.<productId>` is not used here
 */
export function OptionGroup({ option, variants, chosen, onChoose, groupRef, name = 'opt' }) {
  const { t } = useTranslation('storefront')
  const picked = option.values.find((v) => v.id === chosen[option.id])
  const field = `${name}.${option.id}`
  return (
    <fieldset ref={groupRef} tabIndex={-1} className="flex flex-col gap-2 border-0 p-0 focus-visible:outline-2">
      <legend className="mb-2 text-sm font-medium">
        {picked ? t('pdp.optionValue', { name: option.name, value: picked.label }) : option.name}
      </legend>
      {option.display === 'select' ? (
        <NativeSelect
          name={field}
          aria-label={option.name}
          value={chosen[option.id] ?? ''}
          placeholder={t('pdp.choose')}
          onChange={(e) => onChoose(option.id, e.target.value)}
          options={option.values.map((v) => ({ value: v.id, label: v.label }))}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {option.values.map((v) => {
            const soldOut = valueSoldOut(variants, chosen, option.id, v.id)
            return (
              <label key={v.id} className="relative">
                <input
                  type="radio"
                  name={field}
                  value={v.id}
                  checked={chosen[option.id] === v.id}
                  onChange={() => onChoose(option.id, v.id)}
                  aria-disabled={soldOut || undefined}
                  className="peer sr-only"
                />
                <span
                  className={`inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${soldOut ? 'text-muted line-through opacity-60' : ''}`}
                >
                  {option.display === 'swatch' && v.swatch ? <Dot swatch={v.swatch} /> : null}
                  {v.label}
                  {soldOut ? <span className="sr-only">{t('pdp.unavailable')}</span> : null}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

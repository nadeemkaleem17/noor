import { enums } from '@noor/contract'
import { Button } from '@noor/ui/button'
import { RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { MoneyInput } from '@noor/ui/money-input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { Switch } from '@noor/ui/switch'
import { Table, Td, Th } from '@noor/ui/table'
import { useState } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { api } from '@/lib/api'
import { useCan } from '@/lib/session'
import { skuFrom, variantLabel } from '../variants'
import { StockDialog } from './stock-dialog'

const stockModes = enums.stockMode.map((v) => ({ value: v, label: v === 'counted' ? 'Counted' : v === 'made_to_order' ? 'Made to order' : 'Preorder' }))

/**
 * One row per variant (plan/07-admin/03-products.md section 7). On hand is read-only here and changes through "Adjust"; a new product takes its first quantities inline.
 * @param {{ isNew: boolean; }} props
 */
export function VariantTable({ isNew }) {
  const { control, setValue, getValues, setError: setFormError } = useFormContext()
  const can = useCan()
  const variants = /** @type {any[]} */ (useWatch({ control, name: 'variants' }) ?? [])
  const options = /** @type {any[]} */ (useWatch({ control, name: 'options' }) ?? [])
  const [adjusting, setAdjusting] = useState(/** @type {number | null} */ (null))
  const [prefix, setPrefix] = useState('')
  if (variants.length === 0) return <p className="text-sm text-muted">No variants yet. Add options if the product comes in sizes, then generate the variants.</p>

  /** Copies the first row's price (or compare-at) to every row. @param {'price' | 'compareAt'} field */
  const applyToAll = (field) => {
    const first = getValues(`variants.0.${field}`)
    variants.forEach((_, i) => setValue(`variants.${i}.${field}`, first, { shouldDirty: true, shouldValidate: true }))
  }
  const applySkus = () =>
    variants.forEach((v, i) => setValue(`variants.${i}.sku`, skuFrom(prefix, variantLabel(options, v.optionValueKeys)), { shouldDirty: true, shouldValidate: true }))

  /** Asks the server whether a SKU is free; the form says so at once instead of at save. @param {number} i */
  async function checkSku(i) {
    const sku = String(getValues(`variants.${i}.sku`) ?? '').trim()
    if (!sku) return
    try {
      const { available } = await api('admin.products.checkSku', { query: { sku, ...(getValues(`variants.${i}.id`) ? { exceptVariantId: getValues(`variants.${i}.id`) } : {}) } })
      if (!available) setFormError(`variants.${i}.sku`, { type: 'not_unique', message: 'not_unique' })
    } catch {
      // the save checks again
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => applyToAll('price')}>
          Apply the first price to all
        </Button>
        <Button variant="secondary" size="sm" onClick={() => applyToAll('compareAt')}>
          Apply the first compare-at to all
        </Button>
        <Input aria-label="SKU prefix" placeholder="SKU prefix, e.g. KURTA" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-48" />
        <Button variant="secondary" size="sm" disabled={!prefix.trim()} onClick={applySkus}>
          Fill SKUs
        </Button>
      </div>
      <Table label="Variants">
        <caption className="sr-only">Variants</caption>
        <thead>
          <tr>
            <Th>Variant</Th>
            <Th>SKU</Th>
            <Th numeric>Price</Th>
            <Th numeric>Compare-at</Th>
            <Th>Stock type</Th>
            <Th numeric>On hand</Th>
            <Th numeric>Held</Th>
            <Th numeric>Max per order</Th>
            <Th>Enabled</Th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v, i) => {
            const label = variantLabel(options, v.optionValueKeys)
            const counted = v.stockMode === 'counted'
            return (
              <tr key={v.key}>
                <Td className="whitespace-nowrap font-medium">{label}</Td>
                <Td className="min-w-36">
                  <RHFField control={control} name={`variants.${i}.sku`} label={`SKU ${label}`} className="[&>label]:sr-only">
                    {(field) => (
                      <Input
                        {...field}
                        maxLength={40}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        onBlur={() => {
                          field.onBlur()
                          void checkSku(i)
                        }}
                      />
                    )}
                  </RHFField>
                </Td>
                <Td numeric>
                  <RHFField control={control} name={`variants.${i}.price`} label={`Price ${label}`} className="[&>label]:sr-only">
                    {(field) => <MoneyInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} aria-label={`Price ${label}`} value={field.value ?? null} onValueChange={(m) => field.onChange(m ?? undefined)} />}
                  </RHFField>
                </Td>
                <Td numeric>
                  <RHFField control={control} name={`variants.${i}.compareAt`} label={`Compare-at ${label}`} className="[&>label]:sr-only">
                    {(field) => <MoneyInput name={field.name} ref={field.ref} onBlur={field.onBlur} invalid={field.invalid} aria-label={`Compare-at ${label}`} value={field.value ?? null} onValueChange={(m) => field.onChange(m ?? undefined)} />}
                  </RHFField>
                </Td>
                <Td>
                  <Controller control={control} name={`variants.${i}.stockMode`} render={({ field }) => <NativeSelect aria-label={`Stock type ${label}`} {...field} options={stockModes} />} />
                </Td>
                <Td numeric>
                  {!counted ? (
                    '–'
                  ) : v.id ? (
                    <span className="inline-flex items-center gap-2">
                      {v.onHand ?? 0}
                      {can('inventory:adjust') ? (
                        <Button size="sm" variant="secondary" aria-label={`Adjust stock ${label}`} onClick={() => setAdjusting(i)}>
                          Adjust
                        </Button>
                      ) : null}
                    </span>
                  ) : isNew ? (
                    <Controller
                      control={control}
                      name={`initialStock.${v.key}`}
                      render={({ field }) => <NumberInput aria-label={`Opening stock ${label}`} min={0} value={field.value ?? null} onValueChange={(n) => field.onChange(n ?? undefined)} />}
                    />
                  ) : (
                    <span className="text-xs text-muted">Save first</span>
                  )}
                </Td>
                <Td numeric>{counted && v.id ? (v.reserved ?? 0) : '–'}</Td>
                <Td numeric>
                  <Controller control={control} name={`variants.${i}.maxPerOrder`} render={({ field }) => <NumberInput aria-label={`Max per order ${label}`} min={1} max={99} value={field.value ?? null} onValueChange={(n) => field.onChange(n ?? undefined)} />} />
                </Td>
                <Td>
                  <Controller control={control} name={`variants.${i}.enabled`} render={({ field }) => <Switch label={<span className="sr-only">{`Enabled ${label}`}</span>} checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <StockDialog
        variant={adjusting === null ? null : { id: variants[adjusting]?.id, sku: variants[adjusting]?.sku ?? '', onHand: variants[adjusting]?.onHand, reserved: variants[adjusting]?.reserved }}
        onClose={() => setAdjusting(null)}
        onAdjusted={(r) => {
          const i = variants.findIndex((v) => v.id === r.variantId)
          // stock is not part of the document: the numbers change in the form without making it "unsaved"
          setValue(`variants.${i}.onHand`, r.onHand)
          setValue(`variants.${i}.reserved`, r.reserved)
          setValue(`variants.${i}.stockStatus`, r.stockStatus)
        }}
      />
    </div>
  )
}

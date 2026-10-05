import { componentTypes, enums } from '@noor/contract'
import { Button, IconButton } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { Field, RHFField } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { SectionCard } from '@/components/section-card'
import { formSchemasQuery, sizeChartsQuery } from '@/lib/catalog'
import { ProductPicker } from './product-picker'

const humanise = (/** @type {string} */ v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const typeOptions = componentTypes.map((v) => ({ value: v, label: humanise(v) }))
const fitOptions = enums.fitNote.map((v) => ({ value: v, label: humanise(v) }))

/** What an unstitched set includes: one row per piece (plan/07-admin/03-products.md section 5). */
function ComponentsEditor() {
  const { control } = useFormContext()
  const rows = useFieldArray({ control, name: 'components', keyName: 'rid' })
  return (
    <div className="space-y-3">
      {rows.fields.map((f, i) => (
        <fieldset key={f.rid} className="grid gap-3 rounded-card border border-line p-3 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium">{`Piece ${i + 1}`}</legend>
          <RHFField control={control} name={`components.${i}.type`} label="Type">
            {(field) => <NativeSelect {...field} options={typeOptions} />}
          </RHFField>
          <RHFField control={control} name={`components.${i}.label`} label="Name" required>
            {(field) => <Input {...field} maxLength={60} required />}
          </RHFField>
          <RHFField control={control} name={`components.${i}.quantity`} label="Quantity" hint="For example 3 m">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={20} />}
          </RHFField>
          <RHFField control={control} name={`components.${i}.fabric`} label="Fabric">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} />}
          </RHFField>
          <RHFField control={control} name={`components.${i}.color`} label="Colour">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={40} />}
          </RHFField>
          <RHFField control={control} name={`components.${i}.technique`} label="Technique">
            {(field) => <Input {...field} value={field.value ?? ''} maxLength={60} />}
          </RHFField>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <Controller control={control} name={`components.${i}.included`} render={({ field }) => <Checkbox label="Included in the price" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
            <span className="ms-auto flex gap-1">
              <IconButton label={`Move piece ${i + 1} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={i === 0} onClick={() => rows.move(i, i - 1)} />
              <IconButton label={`Move piece ${i + 1} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={i === rows.fields.length - 1} onClick={() => rows.move(i, i + 1)} />
              <IconButton label={`Remove piece ${i + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => rows.remove(i)} />
            </span>
          </div>
        </fieldset>
      ))}
      {rows.fields.length < 12 ? (
        <Button variant="secondary" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => rows.append({ type: 'shirt', label: '', included: true })}>
          Add a piece
        </Button>
      ) : null}
    </div>
  )
}

/** Size chart and fit, for stitched clothes and footwear. */
function SizingFields() {
  const { control } = useFormContext()
  const { data: charts } = useSuspenseQuery(sizeChartsQuery)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <RHFField control={control} name="sizeChartId" label="Size chart">
        {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="No size chart" options={charts.items.map((c) => ({ value: c.id, label: c.title }))} />}
      </RHFField>
      <RHFField control={control} name="fit.note" label="Fit">
        {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="Not set" options={fitOptions} />}
      </RHFField>
      <RHFField control={control} name="fit.cut" label="Cut">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={40} />}
      </RHFField>
      <RHFField control={control} name="fit.modelHeightCm" label="Model height (cm)">
        {(field) => <NumberInput name={field.name} ref={field.ref} min={100} max={230} value={field.value ?? null} onValueChange={(n) => field.onChange(n ?? undefined)} />}
      </RHFField>
      <RHFField control={control} name="fit.modelWears" label="Model wears">
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={10} />}
      </RHFField>
    </div>
  )
}

/** Lead time, deposit and the custom-size form of a made-to-order product. */
function MadeToOrderFields() {
  const { control, setValue, getValues } = useFormContext()
  const { data: forms } = useSuspenseQuery(formSchemasQuery)
  const min = useWatch({ control, name: 'madeToOrder.leadMinDays' })
  const max = useWatch({ control, name: 'madeToOrder.leadMaxDays' })
  const auto = min !== undefined && max !== undefined ? `Made for you in ${min}–${max} days` : ''
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Lead time (days)" required>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="madeToOrder.leadMinDays"
            render={({ field }) => <NumberInput aria-label="Shortest lead time in days" min={0} max={365} value={field.value ?? null} onValueChange={(n) => field.onChange(n ?? undefined)} />}
          />
          <span aria-hidden>to</span>
          <Controller
            control={control}
            name="madeToOrder.leadMaxDays"
            render={({ field }) => <NumberInput aria-label="Longest lead time in days" min={0} max={365} value={field.value ?? null} onValueChange={(n) => field.onChange(n ?? undefined)} />}
          />
        </div>
      </Field>
      <RHFField control={control} name="madeToOrder.label" label="Lead time wording" hint={auto ? `Left empty, the shop says "${auto}".` : undefined}>
        {(field) => <Input {...field} value={field.value ?? ''} maxLength={80} placeholder={auto} />}
      </RHFField>
      <RHFField control={control} name="madeToOrder.depositPercent" label="Deposit (%)" hint="Empty means no deposit.">
        {(field) => (
          <NumberInput
            name={field.name}
            ref={field.ref}
            min={0}
            max={100}
            format={{ maximumFractionDigits: 2 }}
            value={field.value ?? null}
            onValueChange={(n) => field.onChange(n ?? undefined)}
          />
        )}
      </RHFField>
      <RHFField control={control} name="customSizeSchemaId" label="Custom-size form">
        {(field) => <NativeSelect {...field} value={field.value ?? ''} placeholder="No custom sizes" options={forms.items.map((f) => ({ value: f.id, label: f.title }))} />}
      </RHFField>
      <Controller
        control={control}
        name="madeToOrder.returnable"
        render={({ field }) => (
          <Checkbox
            label="Can be returned"
            checked={Boolean(field.value)}
            onCheckedChange={(on) => {
              field.onChange(on)
              // the object needs both lead times to be valid; the person fills them in next
              if (getValues('madeToOrder.leadMinDays') === undefined) setValue('madeToOrder.leadMinDays', 0)
            }}
          />
        )}
      />
    </div>
  )
}

/**
 * The part of the editor that depends on the product's type: what a set includes, sizing, made-to-order terms, or the children of a bundle. Other types show nothing here.
 * Fields of a hidden part keep their values until the product is saved (plan/07-admin/03-products.md section 4).
 * @param {{ productId?: string; }} props
 */
export function KindSection({ productId }) {
  const { control } = useFormContext()
  const kind = useWatch({ control, name: 'kind' })
  if (kind === 'unstitched') {
    return (
      <SectionCard id="kind" title="What's included" description="Each piece of the set. At least one is needed to publish.">
        <ComponentsEditor />
      </SectionCard>
    )
  }
  if (kind === 'stitched' || kind === 'footwear') {
    return (
      <SectionCard id="kind" title="Sizing">
        <SizingFields />
        {kind === 'stitched' ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium">What's included (optional)</summary>
            <div className="pt-3">
              <ComponentsEditor />
            </div>
          </details>
        ) : null}
      </SectionCard>
    )
  }
  if (kind === 'made_to_order') {
    return (
      <SectionCard id="kind" title="Made to order">
        <MadeToOrderFields />
        <SizingFields />
      </SectionCard>
    )
  }
  if (kind === 'bundle') {
    return (
      <SectionCard id="kind" title="In this set" description="Two to six products. The customer chooses each one's size.">
        <Controller control={control} name="bundleProductIds" render={({ field }) => <ProductPicker label="Products in the set" value={field.value ?? []} onChange={field.onChange} max={6} excludeId={productId} />} />
      </SectionCard>
    )
  }
  return null
}

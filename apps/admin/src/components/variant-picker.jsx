import { formatMoney } from '@noor/i18n/format'
import { StatusBadge } from '@noor/ui/badge'
import { Button } from '@noor/ui/button'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { NativeSelect } from '@noor/ui/native-select'
import { NumberInput } from '@noor/ui/number-input'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useDebounced } from '@/lib/use-debounced'

/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').AdminProduct>} AdminProduct */

/**
 * One line of a staff-typed order, as the form holds it. The price is not here: the server works it out.
 * @typedef {object} OrderLine
 * @property {string} variantId
 * @property {string} title
 * @property {string} label
 * @property {string} sku
 * @property {number} quantity
 * @property {{ measurements?: Record<string, string | number>; notes?: string }} [customization]
 */

/** The words of a variant: the label of the value it has of each option, in the order of the options. @param {AdminProduct} p @param {string[]} keys */
export const variantLabel = (p, keys) => keys.map((k) => p.options.flatMap((o) => o.values).find((v) => v.key === k)?.label ?? k).join(' / ')

/**
 * The measurements a made-to-measure product asks for, as fields (the same form the customer sees, DOC-06.4).
 * @param {{ schema: import('@noor/contract').CustomSizeForm; values: Record<string, string>; notes: string; onValues: (v: Record<string, string>) => void; onNotes: (n: string) => void }} props
 */
function MeasureForm({ schema, values, notes, onValues, onNotes }) {
  return (
    <fieldset className="space-y-3 rounded-control border border-line p-3">
      <legend className="px-1 text-sm font-medium">{schema.title ?? 'Measurements'}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {schema.fields.map((f) => (
          <Field key={f.key} label={f.unit ? `${f.label} (${f.unit})` : f.label} required={f.required} hint={f.helpText}>
            {f.type === 'select' ? (
              <NativeSelect options={[{ value: '', label: 'Choose' }, ...(f.options ?? [])]} value={values[f.key] ?? ''} onChange={(e) => onValues({ ...values, [f.key]: e.target.value })} />
            ) : (
              <Input type={f.type === 'number' ? 'number' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} min={f.min} max={f.max} step={f.step} value={values[f.key] ?? ''} onChange={(e) => onValues({ ...values, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
      {schema.allowNotes ? (
        <Field label="Notes for the tailor">
          <Input value={notes} maxLength={500} onChange={(e) => onNotes(e.target.value)} />
        </Field>
      ) : null}
    </fieldset>
  )
}

/**
 * Finds a product by title, SKU or handle, then a variant of it, and gives the line to the order (plan/07-admin/06-customers.md section 4, step 2).
 * @param {{ onAdd: (line: OrderLine) => void }} props
 */
export function VariantPicker({ onAdd }) {
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 300)
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(/** @type {number | null} */ (1))
  const [values, setValues] = useState(/** @type {Record<string, string>} */ ({}))
  const [notes, setNotes] = useState('')

  const found = useQuery({
    queryKey: ['orders', 'pick-products', q],
    queryFn: ({ signal }) => api('admin.products.list', { query: /** @type {never} */ ({ q, status: 'active', size: 25, page: 1 }), signal }),
    enabled: q.length >= 2,
  })
  const product = useQuery({ queryKey: ['orders', 'pick-product', productId], queryFn: ({ signal }) => api('admin.products.get', { params: { id: productId }, signal }), enabled: productId !== '' })
  const schemaId = product.data?.customSizeSchemaId
  const schema = useQuery({ queryKey: ['orders', 'pick-form', schemaId], queryFn: ({ signal }) => api('catalog.getFormSchema', { params: { id: /** @type {string} */ (schemaId) }, signal }), enabled: Boolean(schemaId) })

  const p = product.data
  const variants = (p?.variants ?? []).filter((v) => v.enabled)
  const chosen = variants.find((v) => v.id === variantId)
  const bundle = p ? p.kind === 'bundle' || (p.bundleProductIds?.length ?? 0) > 0 : false
  const missing = schema.data ? schema.data.fields.filter((f) => f.required && !(values[f.key] ?? '').trim()) : []
  const ready = chosen !== undefined && quantity !== null && quantity >= 1 && !bundle && missing.length === 0 && (schemaId ? schema.isSuccess : true)

  function add() {
    if (!p || !chosen || quantity === null) return
    const measurements = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, schema.data?.fields.find((f) => f.key === k)?.type === 'number' ? Number(v) : v.trim()]))
    onAdd({
      variantId: chosen.id ?? '',
      title: p.title,
      label: variantLabel(p, chosen.optionValueKeys),
      sku: chosen.sku,
      quantity,
      ...(Object.keys(measurements).length || notes.trim() ? { customization: { ...(Object.keys(measurements).length ? { measurements } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) } } : {}),
    })
    setVariantId('')
    setQuantity(1)
    setValues({})
    setNotes('')
  }

  return (
    <div className="space-y-3">
      <Field label="Find a product" hint="Title, SKU or handle.">
        <Input
          type="search"
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} // Enter finds nothing new here and must not save the form this sits in
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setProductId('')
            setVariantId('')
          }}
        />
      </Field>
      {found.isSuccess && !productId ? (
        found.data.items.length ? (
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-control border border-line">
            {found.data.items.map((row) => (
              <li key={row.id}>
                <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-surface-2" onClick={() => setProductId(row.id)}>
                  <span className="min-w-0">
                    {row.title}
                    {row.colorwayLabel ? ` (${row.colorwayLabel})` : ''}
                    <span className="block text-xs text-muted">{row.variantCount === 1 ? '1 variant' : `${row.variantCount} variants`} · {formatMoney(row.priceFrom, 'en')}</span>
                  </span>
                  <StatusBadge status={row.stockStatus} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No active product matches.</p>
        )
      ) : null}
      {productId && p ? (
        <div className="space-y-3 rounded-control border border-line p-3">
          <p className="flex items-center justify-between gap-2 font-medium">
            {p.title}
            <Button size="sm" variant="ghost" onClick={() => (setProductId(''), setVariantId(''))}>
              Another product
            </Button>
          </p>
          {bundle ? <p className="rounded-control bg-warning-soft px-3 py-2 text-sm">A bundle needs a choice for each part. Take that order on the website for now.</p> : null}
          <Field label="Variant" required>
            <NativeSelect
              options={[
                { value: '', label: 'Choose a variant' },
                ...variants.map((v) => ({ value: v.id ?? '', label: `${variantLabel(p, v.optionValueKeys) || 'Standard'} · ${v.sku} · ${v.stockStatus === 'sold_out' ? 'sold out' : formatMoney(/** @type {never} */ (v.price), 'en')}` })),
              ]}
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            />
          </Field>
          {schema.data ? <MeasureForm schema={schema.data} values={values} notes={notes} onValues={setValues} onNotes={setNotes} /> : null}
          <div className="flex items-end gap-3">
            <Field label="Quantity" required>
              <NumberInput min={1} max={chosen?.maxPerOrder ?? 99} value={quantity} onValueChange={setQuantity} className="w-28" />
            </Field>
            <Button disabled={!ready} onClick={add}>
              Add to order
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

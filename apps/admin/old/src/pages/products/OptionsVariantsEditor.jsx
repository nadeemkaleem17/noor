import { Plus, Trash2, Wand2 } from 'lucide-react'
import { makeId, slugify } from '../../lib/id.js'
import { cartesianOptionValueIds, comboKey } from '../../lib/variants.js'
import { SelectInput, TextInput } from '../../components/Field.jsx'

const ROLE_LABELS = { size: 'Size', color: 'Color', material: 'Material', other: 'Other' }

export default function OptionsVariantsEditor({ product, onChange }) {
  const options = product.options || []
  const variants = product.variants || []

  function updateOptions(next) { onChange({ options: next }) }
  function updateVariants(next) { onChange({ variants: next }) }

  function addOption() {
    updateOptions([...options, { id: makeId('opt'), name: 'New option', role: 'other', display: 'buttons', values: [{ id: makeId('val'), label: 'Value', sortOrder: 0 }] }])
  }
  function removeOption(optId) {
    const gone = new Set(options.find((o) => o.id === optId)?.values.map((v) => v.id))
    const seen = new Set()
    const nextVariants = variants
      .map((v) => ({ ...v, optionValueIds: v.optionValueIds.filter((id) => !gone.has(id)) }))
      .filter((v) => {
        const key = comboKey(v.optionValueIds)
        if (seen.has(key)) return false // two variants collapsed into the same combination
        seen.add(key)
        return true
      })
    onChange({ options: options.filter((o) => o.id !== optId), variants: nextVariants })
  }
  function patchOption(optId, patch) {
    updateOptions(options.map((o) => (o.id === optId ? { ...o, ...patch } : o)))
  }
  function addValue(optId) {
    updateOptions(options.map((o) => (o.id === optId
      ? { ...o, values: [...o.values, { id: makeId('val'), label: 'New', sortOrder: o.values.length }] }
      : o)))
  }
  function patchValue(optId, valId, patch) {
    updateOptions(options.map((o) => (o.id === optId
      ? { ...o, values: o.values.map((v) => (v.id === valId ? { ...v, ...patch } : v)) }
      : o)))
  }
  function removeValue(optId, valId) {
    onChange({
      options: options.map((o) => (o.id === optId ? { ...o, values: o.values.filter((v) => v.id !== valId) } : o)),
      variants: variants.filter((v) => !v.optionValueIds.includes(valId)),
    })
  }

  function generateVariants() {
    const combos = cartesianOptionValueIds(options)
    const existingByKey = new Map(variants.map((v) => [comboKey(v.optionValueIds), v]))
    const skuBase = slugify(product.title).slice(0, 12).toUpperCase().replace(/-/g, '')
    const next = combos.map((ids) => {
      const existing = existingByKey.get(comboKey(ids))
      if (existing) return existing
      return {
        id: makeId('v'),
        sku: `${skuBase}-${ids.join('-').toUpperCase() || 'DEFAULT'}`,
        optionValueIds: ids,
        price: variants[0]?.price || { amount: 0, currency: 'PKR' },
        stock: { status: 'in_stock', quantity: 10, maxPerOrder: 10 },
      }
    })
    updateVariants(next)
  }

  function patchVariant(id, patch) {
    updateVariants(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }
  function removeVariantRow(id) {
    updateVariants(variants.filter((v) => v.id !== id))
  }

  function labelFor(ids) {
    if (!ids.length) return '—'
    return ids.map((id, i) => options[i]?.values.find((v) => v.id === id)?.label || id).join(' / ')
  }

  const vName = (v) => (v.optionValueIds.length ? labelFor(v.optionValueIds) : 'default variant')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Options</span>
          <button className="btn ghost sm" onClick={addOption}><Plus size={13} /> Add option</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {options.map((opt) => (
            <div key={opt.id} className="card card-pad">
              <div className="form-grid cols-3" style={{ marginBottom: 12 }}>
                <TextInput label="Name" value={opt.name} onChange={(e) => patchOption(opt.id, { name: e.target.value })} />
                <SelectInput
                  label="Role" value={opt.role} onChange={(e) => patchOption(opt.id, { role: e.target.value })}
                  options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
                />
                <SelectInput
                  label="Display" value={opt.display} onChange={(e) => patchOption(opt.id, { display: e.target.value })}
                  options={[{ value: 'buttons', label: 'Buttons' }, { value: 'swatch', label: 'Swatch' }, { value: 'select', label: 'Dropdown' }]}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {opt.values.map((val, vi) => (
                  <div key={val.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 4px 4px 10px' }}>
                    <input
                      aria-label={`${opt.name} value ${vi + 1}`}
                      value={val.label}
                      onChange={(e) => patchValue(opt.id, val.id, { label: e.target.value })}
                      style={{ border: 'none', background: 'none', width: 70, fontSize: 12.5 }}
                    />
                    <button className="btn ghost icon sm" aria-label={`Remove ${val.label || 'value'} from ${opt.name}`} onClick={() => removeValue(opt.id, val.id)}><Trash2 size={12} /></button>
                  </div>
                ))}
                <button className="btn secondary sm" onClick={() => addValue(opt.id)}><Plus size={12} /> value</button>
              </div>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button className="btn ghost sm" onClick={() => removeOption(opt.id)}><Trash2 size={13} /> Remove option</button>
              </div>
            </div>
          ))}
          {options.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No options — this product sells as a single variant (e.g. an accessory).</p>}
        </div>
      </div>

      <div>
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Variants ({variants.length})</span>
          <button className="btn secondary sm" onClick={generateVariants}><Wand2 size={13} /> Generate from options</button>
        </div>
        <div className="card table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Variant</th><th>SKU</th><th>Price</th><th>Compare at</th><th>Stock status</th><th>Qty</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td>{labelFor(v.optionValueIds)}</td>
                  <td>
                    <input className="input mono" aria-label={`SKU for ${vName(v)}`} style={{ height: 32, width: 150 }} value={v.sku} onChange={(e) => patchVariant(v.id, { sku: e.target.value })} />
                  </td>
                  <td>
                    <input className="input mono" aria-label={`Price for ${vName(v)}`} style={{ height: 32, width: 100 }} type="number" value={v.price.amount / 100}
                      onChange={(e) => patchVariant(v.id, { price: { amount: Math.round(Number(e.target.value) * 100), currency: 'PKR' } })} />
                  </td>
                  <td>
                    <input className="input mono" aria-label={`Compare-at price for ${vName(v)}`} style={{ height: 32, width: 100 }} type="number" value={v.compareAt ? v.compareAt.amount / 100 : ''}
                      placeholder="—"
                      onChange={(e) => patchVariant(v.id, { compareAt: e.target.value ? { amount: Math.round(Number(e.target.value) * 100), currency: 'PKR' } : undefined })} />
                  </td>
                  <td>
                    <select className="input" aria-label={`Stock status for ${vName(v)}`} style={{ height: 32, width: 130 }} value={v.stock.status}
                      onChange={(e) => patchVariant(v.id, { stock: { ...v.stock, status: e.target.value } })}>
                      <option value="in_stock">In stock</option>
                      <option value="low_stock">Low stock</option>
                      <option value="sold_out">Sold out</option>
                      <option value="made_to_order">Made to order</option>
                      <option value="preorder">Preorder</option>
                    </select>
                  </td>
                  <td>
                    <input className="input mono" aria-label={`Quantity for ${vName(v)}`} style={{ height: 32, width: 70 }} type="number" value={v.stock.quantity ?? ''}
                      onChange={(e) => patchVariant(v.id, { stock: { ...v.stock, quantity: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                  </td>
                  <td><button className="btn ghost icon sm" aria-label={`Remove variant ${vName(v)}`} onClick={() => removeVariantRow(v.id)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
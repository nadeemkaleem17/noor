import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { Drawer, ConfirmDialog, StatusPill } from '../../components/ui.jsx'
import { TextInput, SelectInput, NumberInput, CheckboxRow } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { formatMoney } from '../../lib/format.js'
import { useToast } from '../../context/toastContext.js'

export default function Promos() {
  const { items: promos, create, update, remove } = useCollection('promos')
  const { items: categories } = useCollection('categories')
  const push = useToast()
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openNew() {
    setEditing({
      isNew: true, code: '', type: 'percent', value: 10, usageCount: 0, status: 'active',
      appliesTo: { scope: 'all', categoryIds: [], productIds: [] },
    })
  }
  function toggleCategory(id) {
    const current = editing.appliesTo?.categoryIds || []
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    setEditing({ ...editing, appliesTo: { ...editing.appliesTo, scope: 'categories', categoryIds: next } })
  }
  function save() {
    const payload = { ...editing, code: editing.code.toUpperCase(), isNew: undefined }
    const saved = editing.isNew ? create(payload, 'promo') : update(editing.id, payload)
    if (!saved) return
    push('Promo code saved', 'success')
    setEditing(null)
  }

  return (
    <div className="page">
      <PageHeader
        title="Promo codes"
        description="Server-validated against every cart quote (doc 03 §1) — the storefront never computes discounts itself."
        actions={<button className="btn primary" onClick={openNew}><Plus size={15} /> New promo code</button>}
      />
      <div className="card table-wrap">
        <table className="grid">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Applies to</th><th>Min spend</th><th>Usage</th><th>Window</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => setEditing(p)}>
                <td className="mono" style={{ fontWeight: 500 }}>{p.code}</td>
                <td style={{ textTransform: 'capitalize' }}>{p.type.replace('_', ' ')}</td>
                <td className="mono">{p.type === 'percent' ? `${p.value}%` : p.type === 'flat' ? formatMoney({ amount: p.value * 100, currency: 'PKR' }) : '—'}</td>
                <td>
                  {!p.appliesTo || p.appliesTo.scope === 'all' ? 'All products'
                    : p.appliesTo.scope === 'categories' ? `${p.appliesTo.categoryIds.length} categor${p.appliesTo.categoryIds.length === 1 ? 'y' : 'ies'}`
                    : `${p.appliesTo.productIds.length} product${p.appliesTo.productIds.length === 1 ? '' : 's'}`}
                </td>
                <td className="mono">{p.minSpend ? formatMoney(p.minSpend) : '—'}</td>
                <td className="mono">{p.usageCount}{p.usageLimit ? ` / ${p.usageLimit}` : ''}{p.perCustomerLimit ? ` · ${p.perCustomerLimit}/customer` : ''}</td>
                <td style={{ fontSize: 12 }}>{p.startsAt || p.endsAt ? `${p.startsAt ? new Date(p.startsAt).toLocaleDateString() : '…'} – ${p.endsAt ? new Date(p.endsAt).toLocaleDateString() : '…'}` : 'No limit'}</td>
                <td><StatusPill status={p.status} /></td>
                <td onClick={(e) => e.stopPropagation()}><button className="btn ghost icon sm" onClick={() => setDeleteTarget(p)}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Drawer
          title={editing.code || 'New promo code'}
          onClose={() => setEditing(null)}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}
        >
          <TextInput label="Code" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
          <div className="form-grid">
            <SelectInput label="Type" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}
              options={[{ value: 'percent', label: 'Percent off' }, { value: 'flat', label: 'Flat amount off' }, { value: 'free_shipping', label: 'Free shipping' }]} />
            {editing.type !== 'free_shipping' && (
              <NumberInput label={editing.type === 'percent' ? 'Percent (%)' : 'Amount (Rs.)'} value={editing.value} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} />
            )}
          </div>
          <div className="form-grid">
            <NumberInput label="Min spend (Rs., optional)" value={editing.minSpend ? editing.minSpend.amount / 100 : ''} onChange={(e) => setEditing({ ...editing, minSpend: e.target.value ? { amount: Number(e.target.value) * 100, currency: 'PKR' } : undefined })} />
            <NumberInput label="Usage limit, total (optional)" value={editing.usageLimit ?? ''} onChange={(e) => setEditing({ ...editing, usageLimit: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="form-grid">
            <NumberInput label="Per-customer limit (optional)" value={editing.perCustomerLimit ?? ''} onChange={(e) => setEditing({ ...editing, perCustomerLimit: e.target.value ? Number(e.target.value) : undefined })} />
            <SelectInput label="Status" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              options={['active', 'scheduled', 'expired', 'disabled'].map((v) => ({ value: v, label: v }))} />
          </div>
          <div className="form-grid">
            <TextInput label="Starts (optional)" type="date" value={editing.startsAt ? editing.startsAt.slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, startsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
            <TextInput label="Ends (optional)" type="date" value={editing.endsAt ? editing.endsAt.slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </div>

          <div className="field">
            <label>Applies to</label>
            <SelectInput
              value={editing.appliesTo?.scope || 'all'}
              onChange={(e) => setEditing({ ...editing, appliesTo: { scope: e.target.value, categoryIds: editing.appliesTo?.categoryIds || [], productIds: editing.appliesTo?.productIds || [] } })}
              options={[{ value: 'all', label: 'All products' }, { value: 'categories', label: 'Specific categories' }, { value: 'products', label: 'Specific products (edit on the product)' }]}
            />
            {editing.appliesTo?.scope === 'categories' && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {categories.map((c) => (
                  <CheckboxRow key={c.id} label={c.name} checked={editing.appliesTo.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                ))}
              </div>
            )}
          </div>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.code}"?`}
          body="Customers won't be able to apply this code any more."
          confirmLabel="Delete code"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); push('Promo code deleted', 'danger'); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { Drawer, ConfirmDialog, SwatchDot, Pill } from '../../components/ui.jsx'
import { TextInput, SelectInput } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { slugify, slugifyLoose } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

export default function Attributes() {
  const { items: attributes, create, update, remove } = useCollection('attributes')
  const push = useToast()
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openNew() {
    setEditing({ isNew: true, key: '', label: '', type: 'enum', display: 'checkbox', filterable: true, values: [] })
  }
  function save() {
    const values = editing.values.map((v) => ({ ...v, _new: undefined }))
    const saved = editing.isNew
      ? create({ ...editing, values, id: editing.key, isNew: undefined }, editing.key)
      : update(editing.id, { ...editing, values })
    if (!saved) return
    push('Attribute saved', 'success')
    setEditing(null)
  }
  function addValue() {
    setEditing({ ...editing, values: [...editing.values, { id: '', label: '', sortOrder: editing.values.length, _new: true }] })
  }
  function patchValue(i, patch) {
    const next = [...editing.values]
    next[i] = { ...next[i], ...patch }
    setEditing({ ...editing, values: next })
  }
  function removeValue(i) {
    setEditing({ ...editing, values: editing.values.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="page">
      <PageHeader
        title="Attributes"
        description="Canonical filterable values (doc 03 §5) — ids + labels, never free text, so filters never fragment."
        actions={<button className="btn primary" onClick={openNew}><Plus size={15} /> New attribute</button>}
      />
      <div className="card table-wrap">
        <table className="grid">
          <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Values</th><th>Filterable</th><th></th></tr></thead>
          <tbody>
            {attributes.map((a) => (
              <tr key={a.key} className="clickable" onClick={() => setEditing(a)}>
                <td>{a.label}</td>
                <td className="mono">{a.key}</td>
                <td>{a.type}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {a.values.slice(0, 6).map((v) => (
                    <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <SwatchDot swatch={v.swatch} />{v.label}
                    </span>
                  ))}
                  {a.values.length > 6 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{a.values.length - 6} more</span>}
                </td>
                <td>{a.filterable ? <Pill tone="success">Yes</Pill> : <Pill tone="neutral">No</Pill>}</td>
                <td onClick={(e) => e.stopPropagation()}><div className="row-actions"><button className="btn ghost icon sm" onClick={() => setDeleteTarget(a)}><Trash2 size={13} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Drawer
          title={editing.label || 'New attribute'}
          onClose={() => setEditing(null)}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}
        >
          <div className="form-grid">
            <TextInput label="Label" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            <TextInput label="Key" value={editing.key} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, key: slugifyLoose(e.target.value) })} onBlur={(e) => setEditing({ ...editing, key: slugify(e.target.value) })} hint={editing.isNew ? 'e.g. fabric, occasion' : 'Keys can’t change once created — products refer to them'} />
          </div>
          <div className="form-grid">
            <SelectInput label="Type" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}
              options={['enum', 'number', 'boolean', 'color'].map((v) => ({ value: v, label: v }))} />
            <SelectInput label="Filter display" value={editing.display} onChange={(e) => setEditing({ ...editing, display: e.target.value })}
              options={['checkbox', 'swatch', 'buttons', 'range'].map((v) => ({ value: v, label: v }))} />
          </div>
          <div className="field">
            <label>Values</label>
            {editing.values.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input className="input" placeholder="label" value={v.label} onChange={(e) => patchValue(i, v._new ? { label: e.target.value, id: slugify(e.target.value) } : { label: e.target.value })} />
                <button className="btn ghost icon sm" onClick={() => removeValue(i)}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn secondary sm" onClick={addValue}><Plus size={12} /> Add value</button>
          </div>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.label}"?`}
          body="Products using this attribute will keep their stored values, but the filter will no longer appear."
          confirmLabel="Delete attribute"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); push('Attribute deleted', 'danger'); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}
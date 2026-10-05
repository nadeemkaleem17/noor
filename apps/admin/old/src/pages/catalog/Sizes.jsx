import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { Drawer, ConfirmDialog, EmptyState } from '../../components/ui.jsx'
import { TextInput, TextArea, SelectInput } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { makeId, slugify } from '../../lib/id.js'
import { useToast } from '../../context/toastContext.js'

export default function Sizes() {
  const { items: sizeSystems, create: createSystem, update: updateSystem, remove: removeSystem } = useCollection('sizeSystems')
  const { items: charts, create, update, remove } = useCollection('sizeCharts')
  const push = useToast()
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingSystem, setEditingSystem] = useState(null)
  const [deleteSystemTarget, setDeleteSystemTarget] = useState(null)

  function openNewSystem() {
    setEditingSystem({ isNew: true, name: 'New size system', values: [{ id: '', label: '', sortOrder: 0, _new: true }] })
  }
  function saveSystem() {
    const payload = { ...editingSystem, isNew: undefined, values: editingSystem.values.map((v) => ({ ...v, _new: undefined })) }
    const saved = editingSystem.isNew ? createSystem(payload, 'sizesys') : updateSystem(editingSystem.id, payload)
    if (!saved) return
    push('Size system saved', 'success')
    setEditingSystem(null)
  }
  function addSystemValue() {
    setEditingSystem({ ...editingSystem, values: [...editingSystem.values, { id: '', label: '', sortOrder: editingSystem.values.length, _new: true }] })
  }
  function patchSystemValue(i, patch) {
    const next = [...editingSystem.values]
    next[i] = { ...next[i], ...patch }
    setEditingSystem({ ...editingSystem, values: next })
  }
  function removeSystemValue(i) {
    setEditingSystem({ ...editingSystem, values: editingSystem.values.filter((_, idx) => idx !== i) })
  }

  function openNew() {
    setEditing({
      isNew: true, title: 'New size chart', unit: 'in', notes: '',
      tables: [{ id: makeId('tbl'), title: 'Shirt', columns: ['XS', 'S', 'M', 'L', 'XL'], rows: [{ label: 'Chest', values: [34, 36, 38, 40, 42] }] }],
    })
  }
  function save() {
    const saved = editing.isNew ? create({ ...editing, isNew: undefined }, 'chart') : update(editing.id, editing)
    if (!saved) return
    push('Size chart saved', 'success')
    setEditing(null)
  }

  function patchTable(idx, patch) {
    const tables = [...editing.tables]
    tables[idx] = { ...tables[idx], ...patch }
    setEditing({ ...editing, tables })
  }
  function patchRow(tIdx, rIdx, patch) {
    const tables = [...editing.tables]
    const rows = [...tables[tIdx].rows]
    rows[rIdx] = { ...rows[rIdx], ...patch }
    tables[tIdx] = { ...tables[tIdx], rows }
    setEditing({ ...editing, tables })
  }
  function addRow(tIdx) {
    const tables = [...editing.tables]
    tables[tIdx] = { ...tables[tIdx], rows: [...tables[tIdx].rows, { label: 'New measurement', values: tables[tIdx].columns.map(() => 0) }] }
    setEditing({ ...editing, tables })
  }
  function removeRow(tIdx, rIdx) {
    const tables = [...editing.tables]
    tables[tIdx] = { ...tables[tIdx], rows: tables[tIdx].rows.filter((_, i) => i !== rIdx) }
    setEditing({ ...editing, tables })
  }

  return (
    <div className="page">
      <PageHeader title="Sizes & charts" description="Size systems power option pickers; size charts power the storefront's size-guide drawer (doc 03 §6)." />

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Size systems</span>
        <button className="btn primary sm" onClick={openNewSystem}><Plus size={13} /> New system</button>
      </div>
      <div className="card table-wrap" style={{ marginBottom: 28 }}>
        {sizeSystems.length === 0 ? (
          <div className="card-pad"><EmptyState title="No size systems yet" body="Create one to power option pickers on products." /></div>
        ) : (
          <table className="grid">
            <thead><tr><th>Name</th><th>Values</th><th></th></tr></thead>
            <tbody>
              {sizeSystems.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setEditingSystem(s)}>
                  <td>{s.name}</td>
                  <td>{s.values.map((v) => v.label).join(', ') || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}><button className="btn ghost icon sm" onClick={() => setDeleteSystemTarget(s)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingSystem && (
        <Drawer
          title={editingSystem.name || 'New size system'}
          onClose={() => setEditingSystem(null)}
          footer={<><button className="btn secondary" onClick={() => setEditingSystem(null)}>Cancel</button><button className="btn primary" onClick={saveSystem}>Save</button></>}
        >
          <TextInput label="Name" value={editingSystem.name} onChange={(e) => setEditingSystem({ ...editingSystem, name: e.target.value })} hint="e.g. Alpha (XS–XXL), Numeric (36–48)" />
          <div className="field">
            <label>Values, in order</label>
            {editingSystem.values.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  className="input" placeholder="label, e.g. M"
                  value={v.label}
                  onChange={(e) => patchSystemValue(i, v._new ? { label: e.target.value, id: slugify(e.target.value) } : { label: e.target.value })}
                />
                <button className="btn ghost icon sm" onClick={() => removeSystemValue(i)}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn secondary sm" onClick={addSystemValue}><Plus size={12} /> Add value</button>
          </div>
        </Drawer>
      )}

      {deleteSystemTarget && (
        <ConfirmDialog
          title={`Delete "${deleteSystemTarget.name}"?`}
          body="Products using this size system will keep their stored option values, but new products won't be able to pick from it."
          confirmLabel="Delete system"
          onCancel={() => setDeleteSystemTarget(null)}
          onConfirm={() => { removeSystem(deleteSystemTarget.id); push('Size system deleted', 'danger'); setDeleteSystemTarget(null) }}
        />
      )}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Size charts</span>
        <button className="btn primary sm" onClick={openNew}><Plus size={13} /> New chart</button>
      </div>
      <div className="card table-wrap">
        <table className="grid">
          <thead><tr><th>Title</th><th>Unit</th><th>Tables</th><th></th></tr></thead>
          <tbody>
            {charts.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setEditing(c)}>
                <td>{c.title}</td><td>{c.unit}</td><td>{c.tables.map((t) => t.title).join(', ')}</td>
                <td onClick={(e) => e.stopPropagation()}><button className="btn ghost icon sm" onClick={() => setDeleteTarget(c)}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Drawer
          title={editing.title} width="min(680px, 100vw)"
          onClose={() => setEditing(null)}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}
        >
          <div className="form-grid">
            <TextInput label="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <SelectInput label="Unit" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} options={[{ value: 'in', label: 'Inches' }, { value: 'cm', label: 'Centimeters' }]} />
          </div>
          <TextArea label="Notes" rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />

          {editing.tables.map((t, tIdx) => (
            <div key={t.id} className="card card-pad">
              <div className="form-grid" style={{ marginBottom: 10 }}>
                <TextInput label="Table title" value={t.title} onChange={(e) => patchTable(tIdx, { title: e.target.value })} />
                <TextInput
                  label="Columns (comma-separated)" value={t.columns.join(', ')}
                  onChange={(e) => patchTable(tIdx, { columns: e.target.value.split(',').map((s) => s.trim()) })}
                />
              </div>
              <div className="table-wrap">
                <table className="grid">
                  <thead><tr><th>Measurement</th>{t.columns.map((c) => <th key={c}>{c}</th>)}<th></th></tr></thead>
                  <tbody>
                    {t.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td><input className="input" style={{ height: 32, width: 120 }} value={row.label} onChange={(e) => patchRow(tIdx, rIdx, { label: e.target.value })} /></td>
                        {t.columns.map((_, cIdx) => (
                          <td key={cIdx}>
                            <input
                              className="input mono" type="number" style={{ height: 32, width: 64 }}
                              value={row.values[cIdx] ?? ''}
                              onChange={(e) => {
                                const values = [...row.values]
                                values[cIdx] = Number(e.target.value)
                                patchRow(tIdx, rIdx, { values })
                              }}
                            />
                          </td>
                        ))}
                        <td><button className="btn ghost icon sm" onClick={() => removeRow(tIdx, rIdx)}><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn secondary sm" style={{ marginTop: 10 }} onClick={() => addRow(tIdx)}><Plus size={12} /> Add measurement row</button>
            </div>
          ))}
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          body="Products referencing this chart will fall back to no size guide until reassigned."
          confirmLabel="Delete chart"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { remove(deleteTarget.id); push('Size chart deleted', 'danger'); setDeleteTarget(null) }}
        />
      )}
    </div>
  )
}
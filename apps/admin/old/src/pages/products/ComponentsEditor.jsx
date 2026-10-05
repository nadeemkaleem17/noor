import { Plus, Trash2 } from 'lucide-react'
import { makeId } from '../../lib/id.js'

const TYPES = ['shirt', 'dupatta', 'trouser', 'shalwar', 'slip', 'lehnga', 'blouse', 'jacket', 'scarf', 'shoes', 'bag', 'other']

export default function ComponentsEditor({ components, onChange }) {
  function add() {
    onChange([...components, { id: makeId('comp'), type: 'shirt', label: 'New piece', included: true }])
  }
  function patch(id, p) {
    onChange(components.map((c) => (c.id === id ? { ...c, ...p } : c)))
  }
  function remove(id) {
    onChange(components.filter((c) => c.id !== id))
  }

  return (
    <div>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>What's in the set</span>
        <button className="btn ghost sm" onClick={add}><Plus size={13} /> Add piece</button>
      </div>
      {components.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>No components listed — used for multi-piece sets (e.g. shirt + dupatta + trouser).</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {components.map((c) => (
          <div key={c.id} className="card card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr 90px 32px', gap: 10, alignItems: 'end' }}>
            <div className="field">
              <label>Type</label>
              <select className="input" value={c.type} onChange={(e) => patch(c.id, { type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Label</label><input className="input" value={c.label} onChange={(e) => patch(c.id, { label: e.target.value })} /></div>
            <div className="field"><label>Fabric</label><input className="input" value={c.fabric || ''} onChange={(e) => patch(c.id, { fabric: e.target.value })} /></div>
            <div className="field"><label>Quantity</label><input className="input" placeholder="e.g. 2.5 m" value={c.quantity || ''} onChange={(e) => patch(c.id, { quantity: e.target.value })} /></div>
            <label className="checkbox-row" style={{ marginBottom: 9 }}>
              <input type="checkbox" checked={c.included !== false} onChange={(e) => patch(c.id, { included: e.target.checked })} /> Included
            </label>
            <button className="btn ghost icon sm" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
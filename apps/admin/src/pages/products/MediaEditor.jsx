import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { makeId } from '../../lib/id.js'

export default function MediaEditor({ media, onChange }) {
  function add() {
    onChange([...media, { id: makeId('med'), type: 'image', url: '', alt: '', width: 900, height: 1200, role: 'model' }])
  }
  function patch(id, p) {
    onChange(media.map((m) => (m.id === id ? { ...m, ...p } : m)))
  }
  function remove(id) {
    onChange(media.filter((m) => m.id !== id))
  }
  function move(id, dir) {
    const idx = media.findIndex((m) => m.id === id)
    const next = [...media]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  return (
    <div>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Media ({media.length})</span>
        <button className="btn ghost sm" onClick={add}><Plus size={13} /> Add image</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>First image is the primary gallery image. Alt text is required for every image.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {media.map((m, i) => (
          <div key={m.id} className="card card-pad" style={{ display: 'grid', gridTemplateColumns: '20px 64px 1fr 1fr 130px 32px', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--muted)' }}>
              <button type="button" className="btn ghost icon sm" aria-label="Move image up" disabled={i === 0} onClick={() => move(m.id, -1)}><ChevronUp size={13} /></button>
              <button type="button" className="btn ghost icon sm" aria-label="Move image down" disabled={i === media.length - 1} onClick={() => move(m.id, 1)}><ChevronDown size={13} /></button>
            </div>
            <img src={m.url || 'https://placehold.co/64x84?text=%20'} alt="" className="thumb" style={{ width: 64, height: 84 }} />
            <div className="field"><label>Image URL</label><input className="input" value={m.url} onChange={(e) => patch(m.id, { url: e.target.value })} /></div>
            <div className="field"><label>Alt text</label><input className="input" value={m.alt} onChange={(e) => patch(m.id, { alt: e.target.value })} /></div>
            <div className="field">
              <label>Role</label>
              <select className="input" value={m.role || 'model'} onChange={(e) => patch(m.id, { role: e.target.value })}>
                {['model', 'flat', 'detail', 'lifestyle', 'swatch'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button className="btn ghost icon sm" aria-label="Remove media" onClick={() => remove(m.id)}><Trash2 size={13} /></button>
            {i === 0 && <div style={{ gridColumn: '2 / -1', fontSize: 11, color: 'var(--accent)' }}>Primary image</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
import { useState } from 'react'
import { useSingleton } from '../../hooks/useCollection.js'
import { TextInput, SelectInput, CheckboxRow } from '../../components/Field.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { useToast } from '../../context/toastContext.js'

const COLOR_LABELS = {
  bg: 'Background', surface: 'Surface (cards)', fg: 'Text', muted: 'Muted text', line: 'Borders',
  accent: 'Accent', onAccent: 'Text on accent', sale: 'Sale / discount', success: 'Success',
  warning: 'Warning', danger: 'Danger', focus: 'Focus ring',
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 36, height: 32, padding: 2, border: '1px solid var(--line)', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
        <input className="input mono" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
      </div>
    </div>
  )
}

export default function Appearance() {
  const { value: saved, save } = useSingleton('storeConfig')
  const push = useToast()
  const [draft, setDraft] = useState(saved)
  const [prevSaved, setPrevSaved] = useState(saved)
  const [dirty, setDirty] = useState(false)

  if (saved !== prevSaved && !dirty) {
    setPrevSaved(saved)
    setDraft(saved)
  }

  if (!draft) return <div className="page"><p>Loading appearance settings…</p></div>

  const theme = draft.theme

  function patchTheme(p) {
    setDraft((d) => ({ ...d, theme: { ...d.theme, ...p } }))
    setDirty(true)
  }
  function patchColor(key, value) {
    patchTheme({ colors: { ...theme.colors, [key]: value } })
  }
  function commit() {
    if (!save(draft)) return // rejected by the contract; stay dirty so nothing is lost
    setDirty(false)
    push('Appearance saved', 'success')
  }

  return (
    <div className="page">
      <PageHeader
        title="Appearance"
        description="Theme tokens the storefront reads at boot (doc 03 §10) — colors, type, radius and layout defaults for the active theme."
        actions={<button className="btn primary" onClick={commit} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card card-pad">
            <div className="section-title">Colors</div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {Object.entries(COLOR_LABELS).filter(([k]) => theme.colors[k] !== undefined).map(([key, label]) => (
                <ColorField key={key} label={label} value={theme.colors[key]} onChange={(v) => patchColor(key, v)} />
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-title">Typography</div>
            <div className="form-grid">
              <TextInput label="Heading font" value={theme.fonts.heading} onChange={(e) => patchTheme({ fonts: { ...theme.fonts, heading: e.target.value } })} hint="Google Font family name" />
              <TextInput label="Body font" value={theme.fonts.body} onChange={(e) => patchTheme({ fonts: { ...theme.fonts, body: e.target.value } })} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-title">Shape</div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <SelectInput label="Controls (buttons, inputs)" value={theme.radius.control} onChange={(e) => patchTheme({ radius: { ...theme.radius, control: e.target.value } })}
                options={['sharp', 'soft', 'round'].map((v) => ({ value: v, label: v }))} />
              <SelectInput label="Cards" value={theme.radius.card} onChange={(e) => patchTheme({ radius: { ...theme.radius, card: e.target.value } })}
                options={['sharp', 'soft', 'round'].map((v) => ({ value: v, label: v }))} />
              <SelectInput label="Media (images)" value={theme.radius.media} onChange={(e) => patchTheme({ radius: { ...theme.radius, media: e.target.value } })}
                options={['none', 'soft'].map((v) => ({ value: v, label: v }))} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-title">Layout</div>
            <div className="form-grid">
              <SelectInput label="Density" value={theme.density} onChange={(e) => patchTheme({ density: e.target.value })}
                options={['comfortable', 'compact'].map((v) => ({ value: v, label: v }))} />
              <SelectInput label="Product media ratio" value={theme.mediaRatio} onChange={(e) => patchTheme({ mediaRatio: e.target.value })}
                options={['3/4', '2/3', '4/5', '1/1'].map((v) => ({ value: v, label: v }))} />
              <SelectInput label="Header layout" value={theme.header.layout} onChange={(e) => patchTheme({ header: { ...theme.header, layout: e.target.value } })}
                options={[{ value: 'left', label: 'Logo left' }, { value: 'center', label: 'Logo center' }]} />
            </div>
            <CheckboxRow label="Sticky header" checked={theme.header.sticky} onChange={(v) => patchTheme({ header: { ...theme.header, sticky: v } })} />
          </div>
        </div>

        <div className="card card-pad" style={{ position: 'sticky', top: 20 }}>
          <div className="section-title">Live preview</div>
          <div
            style={{
              background: theme.colors.bg, color: theme.colors.fg, border: `1px solid ${theme.colors.line}`,
              borderRadius: theme.radius.card === 'sharp' ? 4 : theme.radius.card === 'round' ? 20 : 10,
              padding: 18, fontFamily: theme.fonts.body,
            }}
          >
            <div style={{ fontFamily: theme.fonts.heading, fontSize: 18, marginBottom: 4 }}>{draft.brand.name}</div>
            <div style={{ fontSize: 12.5, color: theme.colors.muted, marginBottom: 14 }}>{draft.brand.tagline || 'Store tagline'}</div>
            <div
              style={{
                background: theme.colors.surface, border: `1px solid ${theme.colors.line}`,
                borderRadius: theme.radius.card === 'sharp' ? 4 : theme.radius.card === 'round' ? 16 : 8,
                padding: 12, marginBottom: 12,
              }}
            >
              <div style={{ aspectRatio: theme.mediaRatio.replace('/', ' / '), background: theme.colors.line, borderRadius: theme.radius.media === 'soft' ? 8 : 0, marginBottom: 10 }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>Sample product</div>
              <div style={{ fontSize: 13, color: theme.colors.accent, fontWeight: 600 }}>Rs. 4,500</div>
            </div>
            <button
              style={{
                background: theme.colors.accent, color: theme.colors.onAccent || '#fff', border: 'none',
                borderRadius: theme.radius.control === 'sharp' ? 3 : theme.radius.control === 'round' ? 999 : 6,
                padding: '9px 16px', fontSize: 13, cursor: 'default',
              }}
            >
              Add to cart
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: theme.colors.sale, color: '#fff' }}>Sale</span>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: theme.colors.success, color: '#fff' }}>In stock</span>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: theme.colors.warning, color: '#fff' }}>Low stock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
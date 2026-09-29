import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useCollection } from '../../hooks/useCollection.js'
import { TextInput, TextArea, SelectInput, CheckboxRow, LinesArea } from '../../components/Field.jsx'
import OptionsVariantsEditor from './OptionsVariantsEditor.jsx'
import MediaEditor from './MediaEditor.jsx'
import ImagesEditor from './ImagesEditor.jsx'
import { LoadState } from '../../components/ui.jsx'
import { slugify, slugifyLoose } from '../../lib/id.js'
import { validateItem } from '../../lib/validate.js'
import { syncCollectionMembership } from '../../lib/collections.js'
import { isoToLocalInput, localInputToIso } from '../../lib/format.js'
import { useToast } from '../../context/toastContext.js'
import { TabBar } from '../../components/TabBar.jsx'
import ComponentsEditor from './ComponentsEditor.jsx'

const TABS = ['Details', 'Images', 'Attributes', 'Options & variants', 'Components', 'Media', 'Sizing & fit', 'Merchandising', 'SEO']
const KINDS = ['stitched', 'unstitched', 'made-to-order', 'footwear', 'accessory', 'bundle', 'home', 'beauty']
const COLOR_FAMILIES = ['black', 'white', 'grey', 'beige', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'gold', 'silver', 'multi']
const BADGES = ['new', 'sale', 'bestseller', 'limited', 'made-to-order', 'sold-out']

export default function ProductEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const push = useToast()
  const { items: products, update, status, retry } = useCollection('products')
  const { items: categories } = useCollection('categories')
  const { items: collectionsList } = useCollection('collectionsList')
  const { items: attributeDefs } = useCollection('attributes')
  const { items: sizeCharts } = useCollection('sizeCharts')
  const { items: formSchemas } = useCollection('formSchemas')

  const saved = products.find((p) => p.id === id)
  const [draft, setDraft] = useState(saved)
  const [prevSaved, setPrevSaved] = useState(saved)
  const [prevId, setPrevId] = useState(id)
  const [tab, setTab] = useState('Details')
  const [dirty, setDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState(null)
  const [saving, setSaving] = useState(false)

  // Resetting local state synchronously during render (not in an effect) when the
  // underlying product changes — same pattern as Settings.jsx / the storefront's Product.jsx.
  // The route's id always wins, even mid-edit: navigating to a different product must never
  // carry over a dirty draft, or Save would write product A's data onto product B (F-12).
  if (id !== prevId) {
    setPrevId(id)
    setPrevSaved(saved)
    setDraft(saved)
    setDirty(false)
  } else if (saved !== prevSaved && !dirty) {
    setPrevSaved(saved)
    setDraft(saved)
  }

  useEffect(() => {
    if (!dirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (!saved && status.state !== 'ready') {
    return <div className="page"><LoadState status={status} retry={retry} label="product" /></div>
  }

  if (!saved) {
    return (
      <div className="page">
        <p>Product not found.</p>
        <button className="btn secondary" onClick={() => navigate('/products')}>Back to products</button>
      </div>
    )
  }

  function patch(p) {
    setDraft((d) => ({ ...d, ...p }))
    setDirty(true)
  }

  // The gallery editor hands us updater functions so concurrent uploads never clobber each other.
  function patchImages(next) {
    setDraft((d) => ({ ...d, images: typeof next === 'function' ? next(d.images || []) : next }))
    setDirty(true)
  }

  async function save() {
    const candidate = { ...draft, handle: slugify(draft.handle) }
    const result = validateItem('products', candidate)
    if (!result.success) {
      setValidationErrors(result.errors)
      push('Fix the highlighted errors before saving', 'danger')
      return
    }
    setValidationErrors(null)
    setSaving(true)
    const ok = await update(id, candidate)
    setSaving(false)
    if (!ok) return // the toast already explains why; stay dirty so nothing is lost
    syncCollectionMembership() // keep Collection.productIds in step with this product's collectionIds
    setDirty(false)
    push('Product saved', 'success')
  }

  function toggleInArray(key, value) {
    const arr = draft[key] || []
    patch({ [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] })
  }

  return (
    <div className="page">
      <button
        className="btn ghost sm" style={{ marginBottom: 10 }}
        onClick={() => {
          if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
          navigate('/products')
        }}
      >
        <ArrowLeft size={14} /> All products
      </button>
      <div className="page-head">
        <div>
          <h1>{draft.title || 'Untitled product'}</h1>
          <p className="desc mono">/{draft.handle}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a className="btn secondary" href={`https://example-storefront.test/products/${draft.handle}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Preview
          </a>
          <button className="btn primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        </div>
      </div>

      <TabBar items={TABS.map((t) => ({ key: t, label: t }))} activeKey={tab} onChange={setTab} />

      {validationErrors && (
        <div className="card card-pad" style={{ borderColor: 'var(--danger)', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--danger)' }}>Can't save — this product doesn't match the contract:</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {validationErrors.map((e, i) => <li key={i}><code>{e.path}</code>: {e.message}</li>)}
          </ul>
        </div>
      )}

      {tab === 'Details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          <div className="form-grid">
            <TextInput label="Title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
            <TextInput
              label="Handle (URL slug)" value={draft.handle}
              onChange={(e) => patch({ handle: slugifyLoose(e.target.value) })}
              onBlur={(e) => patch({ handle: slugify(e.target.value) })}
            />
          </div>
          <div className="form-grid cols-3">
            <SelectInput
              label="Status" value={draft.status} onChange={(e) => patch({ status: e.target.value })}
              options={['draft', 'scheduled', 'active', 'archived'].map((v) => ({ value: v, label: v }))}
            />
            <SelectInput
              label="Kind" value={draft.kind} onChange={(e) => patch({ kind: e.target.value })}
              options={KINDS.map((v) => ({ value: v, label: v.replace('-', ' ') }))}
            />
            <SelectInput
              label="Primary category" value={draft.primaryCategoryId}
              onChange={(e) => patch({ primaryCategoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          {draft.status === 'scheduled' && (
            <TextInput
              label="Publish date" type="datetime-local" value={isoToLocalInput(draft.publishedAt)}
              onChange={(e) => patch({ publishedAt: localInputToIso(e.target.value) })}
              hint="The storefront shows this product from this moment on."
            />
          )}
          <div className="form-grid">
            <TextInput label="Subtitle" value={draft.subtitle || ''} onChange={(e) => patch({ subtitle: e.target.value })} />
            <TextInput label="Brand" value={draft.brand || ''} onChange={(e) => patch({ brand: e.target.value || undefined })} />
          </div>
          <TextArea label="Description (Markdown)" rows={5} value={draft.descriptionMd || ''} onChange={(e) => patch({ descriptionMd: e.target.value })} />

          <div className="field">
            <label>Also shown in categories</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {categories.map((c) => (
                <CheckboxRow key={c.id} label={c.name} checked={draft.categoryIds?.includes(c.id)} onChange={() => toggleInArray('categoryIds', c.id)} />
              ))}
            </div>
          </div>
          <div className="field">
            <label>Collections</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {collectionsList.map((c) => (
                <CheckboxRow key={c.id} label={c.title} checked={draft.collectionIds?.includes(c.id)} onChange={() => toggleInArray('collectionIds', c.id)} />
              ))}
            </div>
          </div>
          <div className="field">
            <label>Badges</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {BADGES.map((b) => (
                <CheckboxRow key={b} label={b} checked={draft.badges?.includes(b)} onChange={() => toggleInArray('badges', b)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Attributes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>
          {attributeDefs.map((def) => (
            <div key={def.key} className="field">
              <label>{def.label}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {def.values.map((v) => (
                  <CheckboxRow
                    key={v.id}
                    label={v.label}
                    checked={(draft.attributes?.[def.key] || []).includes(v.id)}
                    onChange={() => {
                      const current = draft.attributes?.[def.key] || []
                      const next = current.includes(v.id) ? current.filter((x) => x !== v.id) : [...current, v.id]
                      patch({ attributes: { ...draft.attributes, [def.key]: next } })
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Options & variants' && <OptionsVariantsEditor product={draft} onChange={patch} />}
      {tab === 'Components' && <ComponentsEditor components={draft.components || []} onChange={(components) => patch({ components })} />}
      {tab === 'Images' && <ImagesEditor images={draft.images || []} onChange={patchImages} />}
      {tab === 'Media' && <MediaEditor media={draft.media || []} onChange={(media) => patch({ media })} />}

      {tab === 'Sizing & fit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 700 }}>
          <div className="form-grid">
            <SelectInput
              label="Size chart" value={draft.sizeChartId || ''} onChange={(e) => patch({ sizeChartId: e.target.value || undefined })}
              options={[{ value: '', label: 'None' }, ...sizeCharts.map((c) => ({ value: c.id, label: c.title }))]}
            />
            <SelectInput
              label="Custom-size form (made-to-order)" value={draft.customSizeSchemaId || ''}
              onChange={(e) => patch({ customSizeSchemaId: e.target.value || undefined })}
              options={[{ value: '', label: 'None' }, ...formSchemas.filter((f) => f.id !== 'form_checkout_address').map((f) => ({ value: f.id, label: f.title }))]}
            />
          </div>
          {draft.kind === 'made-to-order' && (
            <div className="card card-pad">
              <div className="section-title">Made-to-order</div>
              <div className="form-grid cols-3">
                <TextInput label="Lead time (min days)" type="number" value={draft.madeToOrder?.leadTime?.minDays || 0}
                  onChange={(e) => patch({ madeToOrder: { ...draft.madeToOrder, leadTime: { ...draft.madeToOrder?.leadTime, minDays: Number(e.target.value) } } })} />
                <TextInput label="Lead time (max days)" type="number" value={draft.madeToOrder?.leadTime?.maxDays || 0}
                  onChange={(e) => patch({ madeToOrder: { ...draft.madeToOrder, leadTime: { ...draft.madeToOrder?.leadTime, maxDays: Number(e.target.value) } } })} />
                <TextInput label="Deposit %" type="number" value={draft.madeToOrder?.depositPercent || 0}
                  onChange={(e) => patch({ madeToOrder: { ...draft.madeToOrder, depositPercent: Number(e.target.value) } })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <TextInput label="Lead-time label (shown to shoppers)" value={draft.madeToOrder?.leadTime?.label || ''} placeholder="e.g. Ships in 2–3 weeks"
                  onChange={(e) => patch({ madeToOrder: { ...draft.madeToOrder, leadTime: { ...draft.madeToOrder?.leadTime, label: e.target.value } } })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <CheckboxRow label="Returnable" checked={!!draft.madeToOrder?.returnable} onChange={(v) => patch({ madeToOrder: { ...draft.madeToOrder, returnable: v } })} />
              </div>
            </div>
          )}
          <div className="card card-pad">
            <div className="section-title">Fit notes</div>
            <div className="form-grid cols-3">
              <SelectInput
                label="Runs" value={draft.fit?.note || 'true_to_size'} onChange={(e) => patch({ fit: { ...draft.fit, note: e.target.value } })}
                options={[{ value: 'runs_small', label: 'Runs small' }, { value: 'true_to_size', label: 'True to size' }, { value: 'runs_large', label: 'Runs large' }]}
              />
              <SelectInput
                label="Cut" value={draft.fit?.cut || 'regular'} onChange={(e) => patch({ fit: { ...draft.fit, cut: e.target.value } })}
                options={['regular', 'relaxed', 'oversized', 'slim'].map((v) => ({ value: v, label: v }))}
              />
              <TextInput label="Model wears" value={draft.fit?.modelWears || ''} onChange={(e) => patch({ fit: { ...draft.fit, modelWears: e.target.value } })} />
            </div>
          </div>
        </div>
      )}

      {tab === 'Merchandising' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 700 }}>
          <LinesArea key={`h-${draft.id}`} label="Highlights (one per line, max 6)" max={6} value={draft.highlights || []} onCommit={(highlights) => patch({ highlights: highlights.length ? highlights : undefined })} />
          <LinesArea key={`c-${draft.id}`} label="Care instructions (one per line)" value={draft.care || []} onCommit={(care) => patch({ care: care.length ? care : undefined })} />

          <div className="card card-pad">
            <div className="section-title">Style & colourway</div>
            <div className="form-grid">
              <TextInput
                label="Style ID" value={draft.styleId || ''} onChange={(e) => patch({ styleId: slugifyLoose(e.target.value) || undefined })}
                hint="Products that share a style ID are shown as colourways of one design."
              />
              <TextInput
                label="Colourway name" value={draft.colorway?.label || ''}
                onChange={(e) => patch({ colorway: e.target.value ? { family: 'multi', swatch: { hex: ['#cccccc'] }, ...draft.colorway, label: e.target.value } : undefined })}
              />
            </div>
            {draft.colorway && (
              <div className="form-grid" style={{ marginTop: 10 }}>
                <SelectInput label="Colour family" value={draft.colorway.family} onChange={(e) => patch({ colorway: { ...draft.colorway, family: e.target.value } })} options={COLOR_FAMILIES.map((f) => ({ value: f, label: f }))} />
                <div className="field">
                  <label htmlFor="colorway-hex">Swatch colour</label>
                  <input id="colorway-hex" type="color" value={draft.colorway.swatch?.hex?.[0] || '#cccccc'} onChange={(e) => patch({ colorway: { ...draft.colorway, swatch: { hex: [e.target.value] } } })} />
                </div>
              </div>
            )}
            {draft.styleId && (
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
                Other colourways in this style: {products.filter((p) => p.styleId === draft.styleId && p.id !== draft.id).map((p) => p.colorway?.label || p.title).join(', ') || 'none yet'}
              </p>
            )}
          </div>

          <div className="field">
            <label>Related products</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, maxHeight: 200, overflow: 'auto' }}>
              {products.filter((p) => p.id !== draft.id).map((p) => (
                <CheckboxRow key={p.id} label={p.title} checked={draft.relatedIds?.includes(p.id)} onChange={() => {
                  const cur = draft.relatedIds || []
                  const next = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]
                  patch({ relatedIds: next.length ? next : undefined })
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'SEO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          <TextInput label="SEO title" value={draft.seo?.title || ''} onChange={(e) => patch({ seo: { ...draft.seo, title: e.target.value } })} />
          <TextArea label="SEO description" rows={3} value={draft.seo?.description || ''} onChange={(e) => patch({ seo: { ...draft.seo, description: e.target.value } })} />
        </div>
      )}
    </div>
  )
}
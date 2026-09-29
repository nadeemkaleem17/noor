import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, ExternalLink } from 'lucide-react'
import { useSingleton } from '../../hooks/useCollection.js'
import { TextInput } from '../../components/Field.jsx'
import { ImageField } from '../../components/ImageUpload.jsx'
import { LoadState, EmptyState } from '../../components/ui.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import { SiteSettings as SiteSettingsSchema } from '../../contract/schemas.js'
import { makeId } from '../../lib/id.js'
import { API_MODE, UPLOAD_DESTINATION } from '../../lib/db.js'
import { useToast } from '../../context/toastContext.js'

const renumber = (slides) => slides.map((s, i) => ({ ...s, sortOrder: i }))
const blankSlide = () => ({ id: makeId('slide'), imageUrl: '', heading: '', subheading: '', buttonText: '', buttonLink: '/shop', sortOrder: 0 })

// Only relative paths or http(s) URLs make sense as a storefront button link.
const linkProblem = (href) => {
  const v = (href || '').trim()
  if (!v) return null
  if (v.startsWith('/') && !v.startsWith('//')) return null
  return /^https?:\/\//i.test(v) ? null : 'Use a path like /shop or a full https:// link'
}

// What the storefront shell reads: website title, logo, favicon and the home-page hero carousel.
export default function SiteSettings() {
  const { value: saved, save, status, retry } = useSingleton('siteSettings')
  const { value: storeConfig, save: saveStoreConfig } = useSingleton('storeConfig')
  const push = useToast()
  const [draft, setDraft] = useState(saved)
  const [prevSaved, setPrevSaved] = useState(saved)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({}) // path -> message
  const [dragIndex, setDragIndex] = useState(null)

  // Reset the draft when the stored settings change and nothing is being edited (same pattern as Settings.jsx).
  if (saved !== prevSaved && !dirty) {
    setPrevSaved(saved)
    setDraft(saved)
  }

  useEffect(() => {
    if (!dirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (!draft) {
    return (
      <div className="page">
        <PageHeader title="Site settings" description="Website title, logo, favicon and home-page hero slides." />
        <LoadState status={status} retry={retry} label="site settings" rows={5} />
      </div>
    )
  }

  const slides = draft.heroSlides || []
  function patch(p) {
    setDraft((d) => ({ ...d, ...p }))
    setDirty(true)
  }
  function patchSlides(fn) {
    setDraft((d) => ({ ...d, heroSlides: renumber(fn(d.heroSlides || [])) }))
    setDirty(true)
  }
  const patchSlide = (id, p) => patchSlides((list) => list.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const moveSlide = (from, to) => patchSlides((list) => {
    if (to < 0 || to >= list.length) return list
    const next = [...list]
    const [s] = next.splice(from, 1)
    next.splice(to, 0, s)
    return next
  })

  async function commit() {
    const candidate = { ...draft, siteTitle: draft.siteTitle.trim(), heroSlides: renumber(slides) }
    const found = {}
    const r = SiteSettingsSchema.safeParse(candidate)
    if (!r.success) r.error.issues.forEach((i) => { found[i.path.join('.')] ??= i.message })
    candidate.heroSlides.forEach((s, i) => { const p = linkProblem(s.buttonLink); if (p) found[`heroSlides.${i}.buttonLink`] = p })
    setErrors(found)
    if (Object.keys(found).length) {
      push('Fix the highlighted fields before saving', 'danger')
      return
    }
    setSaving(true)
    const ok = await save(candidate)
    setSaving(false)
    if (!ok) return // toast already shown; stay dirty
    // Keep the brand block in the store config in step, so there's one place to edit these.
    if (storeConfig) {
      saveStoreConfig({
        ...storeConfig,
        brand: {
          ...storeConfig.brand,
          name: candidate.siteTitle,
          logo: { ...storeConfig.brand.logo, light: candidate.logoUrl },
          favicon: candidate.faviconUrl || undefined,
        },
      })
    }
    setDirty(false)
    push('Site settings saved', 'success')
  }

  const err = (path) => errors[path]

  return (
    <div className="page">
      <PageHeader
        title="Site settings"
        description={API_MODE
          ? 'What the storefront shows in its header, browser tab and home page. Saved to the API, so the storefront picks it up on its next load.'
          : 'What the storefront shows in its header, browser tab and home page. No API is connected (VITE_API_URL is unset), so this is saved in this browser only.'}
        actions={<button className="btn primary" onClick={commit} disabled={!dirty || saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>}
      />

      <div className="settings-sections">
        <section className="card card-pad settings-section" aria-labelledby="site-brand">
          <h2 id="site-brand" className="section-title">Brand</h2>
          <TextInput
            label="Website title" value={draft.siteTitle}
            onChange={(e) => patch({ siteTitle: e.target.value })}
            hint={err('siteTitle') ? undefined : 'Shown in the browser tab and as the header name when there is no logo.'}
            aria-invalid={!!err('siteTitle')}
          />
          {err('siteTitle') && <span className="field-error" role="alert">{err('siteTitle')}</span>}
          <div className="form-grid">
            <ImageField
              label="Logo" value={draft.logoUrl} onChange={(logoUrl) => patch({ logoUrl })} maxSide={800}
              previewClass="logo" hint="Transparent PNG or WebP works best, around 360 × 90."
            />
            <ImageField
              label="Favicon" value={draft.faviconUrl} onChange={(faviconUrl) => patch({ faviconUrl })} maxSide={256}
              previewClass="favicon" hint="A square image, at least 64 × 64."
            />
          </div>
          <p className="hint">{UPLOAD_DESTINATION}</p>
        </section>

        <section className="card card-pad settings-section" aria-labelledby="site-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 id="site-hero" className="section-title" style={{ margin: 0 }}>Home page hero slides ({slides.length})</h2>
            <button className="btn secondary sm" onClick={() => patchSlides((list) => [...list, blankSlide()])}><Plus size={13} /> Add slide</button>
          </div>
          <p className="hint">Shown as a carousel at the top of the storefront home page, in this order. Drag a slide or use the arrows to reorder.</p>

          {slides.length === 0 ? (
            <EmptyState title="No hero slides" body="The home page will show its default hero until you add one." />
          ) : (
            <ol className="slide-list">
              {slides.map((s, i) => (
                <li
                  key={s.id}
                  className={`slide-card card${dragIndex === i ? ' dragging' : ''}`}
                  onDragOver={(e) => { if (dragIndex !== null) e.preventDefault() }}
                  onDrop={(e) => { if (dragIndex === null) return; e.preventDefault(); moveSlide(dragIndex, i); setDragIndex(null) }}
                >
                  <div className="slide-head">
                    <span
                      className="slide-grip" draggable aria-hidden="true"
                      onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id) }}
                      onDragEnd={() => setDragIndex(null)}
                    ><GripVertical size={15} /></span>
                    <strong className="mono">Slide {i + 1}</strong>
                    <div className="slide-head-actions">
                      <button type="button" className="btn ghost icon sm" aria-label={`Move slide ${i + 1} up`} disabled={i === 0} onClick={() => moveSlide(i, i - 1)}><ChevronUp size={14} /></button>
                      <button type="button" className="btn ghost icon sm" aria-label={`Move slide ${i + 1} down`} disabled={i === slides.length - 1} onClick={() => moveSlide(i, i + 1)}><ChevronDown size={14} /></button>
                      <button type="button" className="btn ghost icon sm" aria-label={`Delete slide ${i + 1}`} onClick={() => patchSlides((list) => list.filter((x) => x.id !== s.id))}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="slide-body">
                    <ImageField
                      label="Image" value={s.imageUrl} onChange={(imageUrl) => patchSlide(s.id, { imageUrl })} maxSide={1920}
                      previewClass="wide" hint={err(`heroSlides.${i}.imageUrl`) ? undefined : 'Wide image, about 1600 × 700.'}
                    />
                    {err(`heroSlides.${i}.imageUrl`) && <span className="field-error" role="alert">{err(`heroSlides.${i}.imageUrl`)}</span>}
                    <div className="form-grid">
                      <div>
                        <TextInput label="Heading" value={s.heading} onChange={(e) => patchSlide(s.id, { heading: e.target.value })} aria-invalid={!!err(`heroSlides.${i}.heading`)} />
                        {err(`heroSlides.${i}.heading`) && <span className="field-error" role="alert">{err(`heroSlides.${i}.heading`)}</span>}
                      </div>
                      <TextInput label="Subheading" value={s.subheading} onChange={(e) => patchSlide(s.id, { subheading: e.target.value })} />
                      <TextInput label="Button text" value={s.buttonText} placeholder="Shop now" onChange={(e) => patchSlide(s.id, { buttonText: e.target.value })} hint="Leave empty for no button." />
                      <div>
                        <TextInput label="Button link" value={s.buttonLink} placeholder="/shop" onChange={(e) => patchSlide(s.id, { buttonLink: e.target.value })} aria-invalid={!!err(`heroSlides.${i}.buttonLink`)} />
                        {err(`heroSlides.${i}.buttonLink`)
                          ? <span className="field-error" role="alert">{err(`heroSlides.${i}.buttonLink`)}</span>
                          : <span className="hint">A storefront path like /shop, or a full link <ExternalLink size={11} style={{ verticalAlign: -1 }} /></span>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

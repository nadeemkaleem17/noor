import { useEffect, useRef, useState } from 'react'
import { Star, Trash2, ChevronLeft, ChevronRight, GripVertical, Loader2, RotateCcw, X, Link2 } from 'lucide-react'
import { z } from 'zod'
import { ImageDropzone } from '../../components/ImageUpload.jsx'
import { uploadImage, UPLOAD_DESTINATION } from '../../lib/db.js'
import { addImages, moveImage, normalizeImages, removeImage, setPrimary, updateImage } from '../../lib/images.js'
import { makeId } from '../../lib/id.js'

const UrlSchema = z.string().trim().url('Enter a full image URL starting with https://').refine((u) => /^https?:\/\//i.test(u), 'Only http(s) URLs')
const altFromName = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

// Product gallery (Product.images): upload from device (many at once), drag to reorder,
// set the main image, delete, and edit alt text. `onChange` receives an updater function
// (prev => next) so uploads finishing in any order never overwrite each other.
export default function ImagesEditor({ images, onChange }) {
  const gallery = normalizeImages(images)
  const [pending, setPending] = useState([]) // uploads in flight or failed: { key, file, preview, name, error }
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [urlText, setUrlText] = useState('')
  const [urlError, setUrlError] = useState(null)
  const previews = useRef(new Set())

  // Free the local preview URLs if the editor unmounts mid-upload (switching tabs).
  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  function start(item) {
    setPending((list) => list.map((p) => (p.key === item.key ? { ...p, error: null } : p)))
    uploadImage(item.file)
      .then(({ url, width, height }) => {
        onChange((prev) => addImages(prev, [{ url, alt: altFromName(item.name), width, height }]))
        setPending((list) => list.filter((p) => p.key !== item.key))
        URL.revokeObjectURL(item.preview)
        previews.current.delete(item.preview)
      })
      .catch((e) => {
        setPending((list) => list.map((p) => (p.key === item.key ? { ...p, error: e.message || 'Upload failed' } : p)))
      })
  }

  function handleFiles(files) {
    const items = files.map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      return { key: makeId('up'), file, preview, name: file.name, error: null }
    })
    setPending((list) => [...list, ...items])
    items.forEach(start)
  }

  function dismiss(item) {
    URL.revokeObjectURL(item.preview)
    previews.current.delete(item.preview)
    setPending((list) => list.filter((p) => p.key !== item.key))
  }

  function addUrl() {
    const r = UrlSchema.safeParse(urlText)
    if (!r.success) { setUrlError(r.error.issues[0].message); return }
    onChange((prev) => addImages(prev, [{ url: r.data, alt: '' }]))
    setUrlText('')
    setUrlError(null)
  }

  const endDrag = () => { setDragIndex(null); setOverIndex(null) }

  return (
    <div className="images-editor">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Images ({gallery.length})</span>
        {pending.some((p) => !p.error) && <span className="hint" role="status">Uploading {pending.filter((p) => !p.error).length}…</span>}
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        The <strong>main</strong> image is shown first on the storefront and on product cards. Drag images to change the order. {UPLOAD_DESTINATION}
      </p>

      <ImageDropzone onFiles={handleFiles} label="Upload images" hint="JPEG, PNG, WebP, GIF or AVIF · up to 15 MB each · several at once" />

      {(gallery.length > 0 || pending.length > 0) && (
        <ul className="image-grid" aria-label="Product images">
          {gallery.map((img, i) => (
            <li
              key={img.id}
              className={`image-card${img.isPrimary ? ' primary' : ''}${dragIndex === i ? ' dragging' : ''}${overIndex === i && dragIndex !== i ? ' drop-target' : ''}`}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', img.id) }}
              onDragOver={(e) => { if (dragIndex === null) return; e.preventDefault(); setOverIndex(i) }}
              onDrop={(e) => { if (dragIndex === null) return; e.preventDefault(); onChange((prev) => moveImage(prev, dragIndex, i)); endDrag() }}
              onDragEnd={endDrag}
            >
              <div className="image-card-media">
                <img src={img.url} alt={img.alt || `Image ${i + 1}`} loading="lazy" draggable={false} />
                <span className="image-drag-handle" aria-hidden="true"><GripVertical size={14} /></span>
                {img.isPrimary && <span className="image-badge"><Star size={11} /> Main</span>}
                <span className="image-pos mono" aria-hidden="true">{i + 1}</span>
              </div>
              <input
                className="input image-alt" aria-label={`Alt text for image ${i + 1}`} placeholder="Describe this image (alt text)"
                value={img.alt} onChange={(e) => onChange((prev) => updateImage(prev, img.id, { alt: e.target.value }))}
              />
              <div className="image-card-actions">
                <button type="button" className="btn ghost icon sm" aria-label={`Move image ${i + 1} earlier`} disabled={i === 0}
                  onClick={() => onChange((prev) => moveImage(prev, i, i - 1))}><ChevronLeft size={14} /></button>
                <button type="button" className="btn ghost icon sm" aria-label={`Move image ${i + 1} later`} disabled={i === gallery.length - 1}
                  onClick={() => onChange((prev) => moveImage(prev, i, i + 1))}><ChevronRight size={14} /></button>
                {img.isPrimary
                  ? <span className="image-main-note">Main image</span>
                  : <button type="button" className="btn ghost sm" onClick={() => onChange((prev) => setPrimary(prev, img.id))}><Star size={12} /> Set as main</button>}
                <button type="button" className="btn ghost icon sm image-delete" aria-label={`Delete image ${i + 1}`}
                  onClick={() => onChange((prev) => removeImage(prev, img.id))}><Trash2 size={13} /></button>
              </div>
            </li>
          ))}

          {pending.map((p) => (
            <li key={p.key} className={`image-card pending${p.error ? ' failed' : ''}`}>
              <div className="image-card-media">
                <img src={p.preview} alt="" />
                {!p.error && <span className="image-busy" role="status"><Loader2 size={20} className="spin" aria-hidden="true" /><span className="sr-only">Uploading {p.name}</span></span>}
              </div>
              <div className="image-pending-name" title={p.name}>{p.name}</div>
              {p.error ? (
                <>
                  <div className="field-error" role="alert">{p.error}</div>
                  <div className="image-card-actions">
                    <button type="button" className="btn secondary sm" onClick={() => start(p)}><RotateCcw size={12} /> Retry</button>
                    <button type="button" className="btn ghost icon sm" aria-label={`Dismiss ${p.name}`} onClick={() => dismiss(p)}><X size={13} /></button>
                  </div>
                </>
              ) : <div className="hint">Uploading…</div>}
            </li>
          ))}
        </ul>
      )}

      <div className="image-url-row" style={{ marginTop: 14 }}>
        <input
          className="input" aria-label="Image URL" placeholder="…or add an image by URL (https://…)"
          value={urlText} onChange={(e) => { setUrlText(e.target.value); setUrlError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }}
        />
        <button type="button" className="btn secondary sm" onClick={addUrl} disabled={!urlText.trim()}><Link2 size={13} /> Add URL</button>
      </div>
      {urlError && <div className="field-error" role="alert">{urlError}</div>}
    </div>
  )
}

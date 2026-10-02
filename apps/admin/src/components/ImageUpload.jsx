import { useId, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, Upload, Link2 } from 'lucide-react'
import { z } from 'zod'
import { uploadImage } from '../lib/db.js'
import { ACCEPT_ATTR } from '../lib/imageFile.js'

const UrlSchema = z.string().trim().url('Enter a full image URL starting with https://').refine((u) => /^https?:\/\//i.test(u), 'Only http(s) URLs')

// Click-or-drop area for picking image files from the device. Calls onFiles(File[]).
export function ImageDropzone({ onFiles, multiple = true, label = 'Upload images', hint, compact = false, disabled = false }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')

  return (
    <div
      className={`dropzone${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      onDragOver={(e) => { if (!hasFiles(e) || disabled) return; e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!hasFiles(e) || disabled) return
        e.preventDefault()
        setOver(false)
        const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'))
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
    >
      <button type="button" className="dropzone-btn" onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload size={compact ? 16 : 20} aria-hidden="true" />
        <span className="dropzone-label">{label}</span>
        {!compact && <span className="dropzone-sub">Click to choose from your device, or drag files here</span>}
      </button>
      {hint && <p className="hint">{hint}</p>}
      <input
        ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple={multiple} hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          e.target.value = '' // allow picking the same file again
          if (files.length) onFiles(files)
        }}
      />
    </div>
  )
}

// A single image setting (logo, favicon, slide image): preview + upload/replace from device + remove,
// with an optional "use a URL instead" field. value/onChange carry the image URL ('' = none).
export function ImageField({ label, value, onChange, hint, maxSide = 1600, previewClass = '', allowUrl = true }) {
  const id = useId()
  const [busy, setBusy] = useState(null) // { preview } while uploading
  const [error, setError] = useState(null)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlText, setUrlText] = useState('')

  async function handleFiles([file]) {
    setError(null)
    const preview = URL.createObjectURL(file)
    setBusy({ preview })
    try {
      const { url } = await uploadImage(file, { maxSide })
      onChange(url)
    } catch (e) {
      setError(e.message || 'Upload failed')
    } finally {
      URL.revokeObjectURL(preview)
      setBusy(null)
    }
  }

  function applyUrl() {
    const r = UrlSchema.safeParse(urlText)
    if (!r.success) { setError(r.error.issues[0].message); return }
    setError(null)
    onChange(r.data)
    setUrlOpen(false)
    setUrlText('')
  }

  const shown = busy?.preview || value
  return (
    <div className="field image-field">
      <label htmlFor={urlOpen ? `${id}-url` : undefined}>{label}</label>
      <div className="image-field-row">
        <div className={`image-field-preview ${previewClass}`}>
          {shown ? <img src={shown} alt="" /> : <ImagePlus size={22} aria-hidden="true" />}
          {busy && <span className="image-busy" role="status"><Loader2 size={18} className="spin" aria-hidden="true" /><span className="sr-only">Uploading…</span></span>}
        </div>
        <div className="image-field-actions">
          <ImageDropzone compact multiple={false} label={value ? 'Replace image' : 'Upload image'} onFiles={handleFiles} disabled={!!busy} />
          <div className="image-field-links">
            {allowUrl && (
              <button type="button" className="btn ghost sm" onClick={() => setUrlOpen((o) => !o)} aria-expanded={urlOpen}>
                <Link2 size={13} /> Use a URL
              </button>
            )}
            {value && !busy && (
              <button type="button" className="btn ghost sm" onClick={() => onChange('')}><Trash2 size={13} /> Remove</button>
            )}
          </div>
        </div>
      </div>
      {urlOpen && (
        <div className="image-url-row">
          <input
            id={`${id}-url`} className="input" placeholder="https://…" value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyUrl() } }}
          />
          <button type="button" className="btn secondary sm" onClick={applyUrl}>Use URL</button>
        </div>
      )}
      {error ? <span className="field-error" role="alert">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  )
}

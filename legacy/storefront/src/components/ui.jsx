import { useState } from 'react'
import { swatchColors } from '../data/mockData'
import { placeholderImage } from '../utils/images'

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}

// Deterministic gradient "photo" so every product looks intentional without real photography.
export function Swatch({ index = 0, label, size = 'md', className = '' }) {
  const [c1, c2] = swatchColors(index)
  const initial = (label || '?').trim().charAt(0).toUpperCase()
  return (
    <div
      className={`swatch swatch-${size} ${className}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      <span>{initial}</span>
    </div>
  )
}

// Product photo — a real `src` when the product has one, otherwise a seeded placeholder — with a
// graceful fallback to the gradient Swatch if it fails to load, so a missing/broken image never
// surfaces as a broken <img> icon. Failure is tracked per URL, so switching to a different image
// (gallery thumbnails) gets a fresh attempt.
export function ProductImage({ src, seed, index = 0, label, size = 'md', className = '', width = 600, height = 800, loading = 'lazy' }) {
  const url = src || placeholderImage(seed, width, height)
  const [failedUrl, setFailedUrl] = useState(null)
  if (failedUrl === url) return <Swatch index={index} label={label} size={size} className={className} />
  return (
    <div className={`swatch swatch-${size} ${className}`}>
      <img
        className="swatch-img"
        src={url}
        alt={label || ''}
        loading={loading}
        onError={() => setFailedUrl(url)}
      />
    </div>
  )
}

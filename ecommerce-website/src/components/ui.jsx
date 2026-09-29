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

// Real (seeded-random) photo with a graceful fallback to the gradient Swatch if the image
// fails to load — a missing/broken image should never surface as a broken <img> icon.
export function ProductImage({ seed, index = 0, label, size = 'md', className = '', width = 600, height = 800 }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Swatch index={index} label={label} size={size} className={className} />
  return (
    <div className={`swatch swatch-${size} ${className}`}>
      <img
        className="swatch-img"
        src={placeholderImage(seed, width, height)}
        alt={label || ''}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

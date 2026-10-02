// Product gallery rules (Product.images in contract/schemas.js). Pure functions, no React:
//  - the array order IS the gallery order; sortOrder always equals the index (0..n-1)
//  - a non-empty gallery has exactly one isPrimary image (the storefront shows it first)
// Every function returns a new, normalized array and never mutates its input.
import { makeId } from './id.js'

// Sort by sortOrder (stable, so ties keep their current order), renumber 0..n-1, and make sure
// exactly one image is primary: the first one flagged primary, or the first image if none is.
export function normalizeImages(images = []) {
  const sorted = images
    .map((img, index) => ({ img, index }))
    .sort((a, b) => (a.img.sortOrder ?? a.index) - (b.img.sortOrder ?? b.index) || a.index - b.index)
    .map(({ img }) => img)
  const primaryIndex = Math.max(0, sorted.findIndex((img) => img.isPrimary))
  return sorted.map((img, i) => ({ ...img, sortOrder: i, isPrimary: i === primaryIndex }))
}

// Append new images ({ url, alt?, width?, height? }) at the end. The first image ever added becomes primary.
export function addImages(images = [], additions = []) {
  const current = normalizeImages(images)
  const appended = additions.map((a, i) => ({
    id: a.id || makeId('img'),
    url: a.url,
    alt: a.alt ?? '',
    ...(a.width && { width: a.width }),
    ...(a.height && { height: a.height }),
    sortOrder: current.length + i,
    isPrimary: false,
  }))
  return normalizeImages([...current, ...appended])
}

// Move the image at `from` to position `to` (drag-and-drop or arrow buttons). Out-of-range is a no-op.
export function moveImage(images = [], from, to) {
  const current = normalizeImages(images)
  if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) return current
  const next = [...current]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return normalizeImages(next.map((img, i) => ({ ...img, sortOrder: i })))
}

export function setPrimary(images = [], id) {
  const current = normalizeImages(images)
  if (!current.some((img) => img.id === id)) return current
  return current.map((img) => ({ ...img, isPrimary: img.id === id }))
}

// Removing the primary image promotes the image that takes its place (the next one), or the new
// last image when the primary was last — so the gallery never ends up without a main image.
export function removeImage(images = [], id) {
  const current = normalizeImages(images)
  const index = current.findIndex((img) => img.id === id)
  if (index === -1) return current
  const wasPrimary = current[index].isPrimary
  const rest = current.filter((img) => img.id !== id).map((img) => ({ ...img, isPrimary: wasPrimary ? false : img.isPrimary }))
  if (wasPrimary && rest.length) rest[Math.min(index, rest.length - 1)].isPrimary = true
  return normalizeImages(rest.map((img, i) => ({ ...img, sortOrder: i })))
}

export function updateImage(images = [], id, patch) {
  return normalizeImages(images).map((img) => (img.id === id ? { ...img, ...patch, id: img.id } : img))
}

export function primaryImage(images = []) {
  return normalizeImages(images).find((img) => img.isPrimary)
}

// Checks a gallery against the rules above; returns [{ path, message }] like validateItem does.
export function imageRuleErrors(images) {
  if (!Array.isArray(images) || images.length === 0) return []
  const errors = []
  const primaries = images.filter((img) => img.isPrimary).length
  if (primaries !== 1) errors.push({ path: 'images', message: `Exactly one image must be the main image (found ${primaries})` })
  images.forEach((img, i) => {
    if (!img.url) errors.push({ path: `images.${i}.url`, message: 'Image is still uploading or has no URL' })
  })
  return errors
}

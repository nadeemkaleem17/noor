// Turning a file picked from the device into something small enough to store:
// validate it (zod), then downscale in the browser so a 6 MB phone photo becomes a few hundred KB.
// The API caps uploads at 2 MB; localStorage has only ~5 MB for the whole admin.
import { z } from 'zod'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(',')
const MAX_INPUT_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024

export const ImageFileSchema = z.object({
  name: z.string(),
  type: z.enum(ACCEPTED_TYPES, { errorMap: () => ({ message: 'Use a JPEG, PNG, WebP, GIF or AVIF image' }) }),
  size: z.number().max(MAX_INPUT_BYTES, 'Images must be under 15 MB'),
})

// Returns an error message, or null if the file is acceptable.
export function checkImageFile(file) {
  const r = ImageFileSchema.safeParse({ name: file?.name ?? '', type: file?.type ?? '', size: file?.size ?? 0 })
  return r.success ? null : r.error.issues[0].message
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

// Downscale so the longest side is at most `maxSide` px. Output is WebP (keeps transparency, small);
// browsers that can't encode WebP fall back to PNG for images that may be transparent, JPEG otherwise.
// Resolves to { blob, width, height, type }.
export async function prepareImage(file, { maxSide = 1600 } = {}) {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This image couldn't be read") })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  let blob = null
  for (const quality of [0.85, 0.7, 0.55]) {
    blob = await toBlob(canvas, 'image/webp', quality)
    if (blob?.type !== 'image/webp') {
      const fallback = file.type === 'image/png' || file.type === 'image/gif' ? 'image/png' : 'image/jpeg'
      blob = await toBlob(canvas, fallback, quality)
    }
    if (blob && blob.size <= MAX_OUTPUT_BYTES) break
  }
  if (!blob) throw new Error("This image couldn't be processed")
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error('This image is still over 2 MB after resizing — try a smaller one')
  return { blob, width, height, type: blob.type }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("This image couldn't be read"))
    reader.readAsDataURL(blob)
  })
}

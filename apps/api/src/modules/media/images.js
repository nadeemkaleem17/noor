// Pure helpers for image files: what a file really is, which sizes we generate, and the URLs of those sizes (plan/08 section 11).
import { imageWidths } from '@noor/contract'

/** Accepted types and the extension each is stored under. */
export const EXTENSIONS = /** @type {const} */ ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })

/** Longest side we accept, in pixels. */
export const MAX_SIDE = 8000

/** How many leading bytes `sniff` needs. */
export const SNIFF_BYTES = 32

/**
 * What a file is, from its first bytes. The name and the declared type are never trusted. Returns null for anything else
 * (HTML, SVG, PDF, a renamed executable ...).
 * @param {Buffer} head
 * @returns {keyof typeof EXTENSIONS | null}
 */
export function sniff(head) {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  if (head.length >= 12 && head.toString('latin1', 4, 8) === 'ftyp' && /avi[fs]/.test(head.toString('latin1', 8, SNIFF_BYTES))) return 'image/avif'
  return null
}

/**
 * The generated widths for an image: every allowed width that fits inside it (never enlarged), and the smallest one for tiny images.
 * @param {number} width
 */
export const sizesFor = (width) => {
  const fits = imageWidths.filter((w) => w <= width)
  return fits.length ? fits : [imageWidths[0]]
}

/** `media/2026/10/<id>.jpg` -> `media/2026/10/<id>` (the folder of its generated sizes). @param {string} objectKey */
export const sizesFolder = (objectKey) => objectKey.replace(/\.[a-z]+$/, '')

/**
 * The generated files of an image, original excluded.
 * @param {string} objectKey @param {number} width
 */
export const sizeKeys = (objectKey, width) => sizesFor(width).flatMap((w) => [`${sizesFolder(objectKey)}/w${w}.webp`, `${sizesFolder(objectKey)}/w${w}.jpg`])

/**
 * What the contract's `Image` carries: a JPEG `src` for old clients and a WebP `srcset` for the rest. Clients never build these URLs.
 * @param {{ objectKey: string, width: number, height: number, alt: string, lqip?: string | null }} m
 * @param {string} imgBase the public base of the image host, without a trailing slash
 */
export function toImage(m, imgBase) {
  const widths = sizesFor(m.width)
  const folder = `${imgBase.replace(/\/$/, '')}/${sizesFolder(m.objectKey)}`
  const srcWidth = [...widths].reverse().find((w) => w <= 828) ?? widths[0]
  return {
    src: `${folder}/w${srcWidth}.jpg`,
    srcset: widths.map((w) => `${folder}/w${w}.webp ${w}w`).join(', '),
    width: m.width,
    height: m.height,
    alt: m.alt,
    ...(m.lqip ? { lqip: m.lqip } : {}),
  }
}

// Placeholder pictures for the demo shop: a coloured gradient with the product's name, made with sharp so nothing has to be downloaded.
import sharp from 'sharp'

const escapeXml = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Darkens a #RRGGBB colour by `pct` percent. @param {string} hex @param {number} pct */
function darken(hex, pct) {
  const n = parseInt(hex.slice(1), 16)
  const f = 1 - pct / 100
  const part = (/** @type {number} */ v) => Math.round(v * f).toString(16).padStart(2, '0')
  return `#${part((n >> 16) & 255)}${part((n >> 8) & 255)}${part(n & 255)}`
}

/**
 * @param {{ text: string, hex: string, caption?: string, width?: number, height?: number }} o
 * @returns {Promise<Buffer>} a JPEG
 */
export function placeholderImage({ text, hex, caption = '', width = 900, height = 1200 }) {
  const size = Math.round(width / 16)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex}"/><stop offset="1" stop-color="${darken(hex, 45)}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="${size}" fill="#ffffff" fill-opacity="0.92">${escapeXml(text)}</text>
    <text x="50%" y="${Math.round(height / 2 + size * 1.6)}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(size * 0.6)}" fill="#ffffff" fill-opacity="0.7">${escapeXml(caption)}</text>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}

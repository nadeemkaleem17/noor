// WCAG 2.x contrast maths (plan/04-design-system/tokens.md section 9). Pure functions, no dependencies;
// the admin Appearance page uses the same code as the CI gate.

/**
 * @typedef {readonly [number, number, number]} Rgb
 */

/**
 * @param {string} hex
 * @returns {Rgb}
 */
export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m?.[1]) throw new RangeError(`not a 6-digit hex color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * @param {Rgb} arg0
 * @returns {string}
 */
export const toHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

/**
 * @param {number} v
 */
const channel = (v) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * @param {string} hex
 * @returns {number}
 */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * WCAG contrast ratio, 1 to 21.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function contrast(a, b) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * `pct` percent of `a` mixed into `b`, in sRGB (what CSS `color-mix(in srgb, a pct%, b)` gives).
 * @param {string} a
 * @param {string} b
 * @param {number} pct
 * @returns {string}
 */
export function mix(a, b, pct) {
  const p = parseHex(a)
  const q = parseHex(b)
  return toHex(/** @type {Rgb} */ (/** @type {unknown} */ ([0, 1, 2].map((i) => (p[i] ?? 0) * (pct / 100) + (q[i] ?? 0) * (1 - pct / 100)))))
}

/** Minimum ratios (DOC-04a section 9). */
export const MIN_TEXT = 4.5
export const MIN_UI = 3

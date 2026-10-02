// WCAG 2.x contrast maths (plan/04-design-system/tokens.md section 9). Pure functions, no dependencies;
// the admin Appearance page uses the same code as the CI gate.

export type Rgb = readonly [number, number, number]

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m?.[1]) throw new RangeError(`not a 6-digit hex color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const toHex = ([r, g, b]: Rgb): string =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

const channel = (v: number) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** `pct` percent of `a` mixed into `b`, in sRGB (what CSS `color-mix(in srgb, a pct%, b)` gives). */
export function mix(a: string, b: string, pct: number): string {
  const p = parseHex(a)
  const q = parseHex(b)
  return toHex([0, 1, 2].map((i) => (p[i] ?? 0) * (pct / 100) + (q[i] ?? 0) * (1 - pct / 100)) as unknown as Rgb)
}

/** Minimum ratios (DOC-04a section 9). */
export const MIN_TEXT = 4.5
export const MIN_UI = 3

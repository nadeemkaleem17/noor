// The design tokens of DOC-06.15 (M8-02): the type scale, the motion tokens, the z-index scale and the shape of the storefront theme.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (/** @type {string} */ p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const app = read('../app/app.css')
const tokens = read('../../../packages/ui/src/tokens.css')

/** Pixels of a CSS length in rem. @param {string} v */
const px = (v) => Math.round(Number(v.replace('rem', '')) * 16)

describe('type scale (DOC-06.15 section 4.1)', () => {
  /** token -> [phone px, desktop px, line height] */
  const scale = {
    display: [40, 64, 1.05], h1: [30, 44, 1.12], h2: [24, 32, 1.2], h3: [20, 24, 1.25], h4: [17, 18, 1.3],
    body: [16, 16, 1.6], ui: [15, 15, 1.4], small: [14, 14, 1.45], caption: [12, 12, 1.4], label: [12, 13, 1.2],
  }
  for (const [name, [phone, desktop, leading]] of Object.entries(scale)) {
    it(`${name}: ${phone} px on a phone, ${desktop} px on a desktop, line height ${leading}`, () => {
      const size = new RegExp(`--text-${name}: ([^;]+);`).exec(app)?.[1] ?? ''
      const clamp = /^clamp\(([\d.]+rem), [^,]+, ([\d.]+rem)\)$/.exec(size)
      expect(px(clamp ? (clamp[1] ?? '') : size)).toBe(phone)
      expect(px(clamp ? (clamp[2] ?? '') : size)).toBe(desktop)
      expect(app).toContain(`--text-${name}--line-height: ${leading};`)
    })
  }
  it('nothing is smaller than 12 px', () => {
    for (const m of app.matchAll(/--text-[a-z0-9]+: (?:clamp\()?([\d.]+rem)/g)) expect(px(m[1] ?? '')).toBeGreaterThanOrEqual(12)
  })
})

describe('motion (DOC-06.15 section 5.1)', () => {
  it('has the durations and the two easings', () => {
    for (const d of ['fast: 100ms', 'base: 200ms', 'slow: 300ms', 'page: 250ms']) expect(tokens).toContain(`--dur-${d};`)
    expect(tokens).toContain('--ease-standard: cubic-bezier(0.2, 0, 0, 1);')
    expect(tokens).toContain('--ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);')
  })
  it('every duration is zero under reduced motion', () => {
    const block = /prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/.exec(tokens)?.[1] ?? ''
    const declared = [...tokens.matchAll(/--(dur-[a-z-]+): \d+ms;/g)].map((m) => m[1])
    expect(declared.length).toBeGreaterThanOrEqual(8)
    for (const d of declared) expect(block, d).toContain(`--${d}: 0ms;`)
  })
})

describe('z-index scale (DOC-06.15 section 4.3)', () => {
  it('runs content, sticky, header, drawer, modal, popover, toast in rising order', () => {
    const z = ['base', 'sticky', 'header', 'drawer', 'modal', 'popover', 'toast'].map((n) => Number(new RegExp(`@utility z-${n} \\{ z-index: (\\d+); \\}`).exec(tokens)?.[1]))
    expect(z.every(Number.isFinite)).toBe(true)
    expect([...z].sort((a, b) => a - b)).toEqual(z)
    expect(new Set(z).size).toBe(z.length)
  })
})

describe('storefront shape (DOC-06.15 section 4.4)', () => {
  it('controls and cards have a 2 px corner, pictures none', () => {
    const block = /\[data-brand="storefront"\] \{([^}]*)\}/.exec(tokens)?.[1] ?? ''
    expect(block).toContain('--sem-radius-control: 2px; --sem-radius-card: 2px; --sem-radius-media: 0;')
  })
})

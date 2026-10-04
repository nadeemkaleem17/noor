// The contrast gate (plan/04-design-system/tokens.md section 9): every text pair is >= 4.5:1, controls and focus >= 3:1.
// Runs in `pnpm test`, so a token change that breaks readability fails CI.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { themePresets } from '@noor/contract'
import { MIN_TEXT, MIN_UI, contrast, mix } from '../src/contrast'
import { resolveColors, themeCss } from '../src/theme'

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')

/**
 * `selector { --sem-x: #hex; ... }` blocks of tokens.css, by exact selector.
 * @param {string} source
 * @returns {Map<string, Record<string, string>>}
 */
function blocks(source) {
  const out = new Map()
  for (const m of source.matchAll(/^(\[data-brand[^\n{]*)\{([^}]*)\}/gm)) {
    const vars = /** @type {Record<string, string>} */ ({})
    for (const v of (m[2] ?? '').matchAll(/--sem-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[v[1] ?? ''] = v[2] ?? ''
    out.set((m[1] ?? '').trim(), vars)
  }
  return out
}

const TEXT_ON_BG = ['fg', 'fg-soft', 'muted', 'accent-text', 'sale', 'success', 'warning', 'danger']
const BACKGROUNDS = ['bg', 'surface', 'surface-2']

/**
 * @param {string} name
 * @param {Record<string, string>} t
 */
function gate(name, t) {
  describe(name, () => {
    for (const fg of TEXT_ON_BG) {
      for (const bg of BACKGROUNDS) {
        it(`${fg} on ${bg} >= ${MIN_TEXT}`, () => expect(contrast(t[fg] ?? '', t[bg] ?? '')).toBeGreaterThanOrEqual(MIN_TEXT))
      }
    }
    it(`on-accent on accent >= ${MIN_TEXT}`, () => expect(contrast(t['on-accent'] ?? '', t['accent'] ?? '')).toBeGreaterThanOrEqual(MIN_TEXT))
    for (const soft of ['success-soft', 'warning-soft', 'danger-soft', 'accent-soft']) {
      it(`fg on ${soft} >= ${MIN_TEXT}`, () => expect(contrast(t['fg'] ?? '', t[soft] ?? '')).toBeGreaterThanOrEqual(MIN_TEXT))
    }
    for (const ui of ['line-strong', 'focus']) {
      for (const bg of ['bg', 'surface']) {
        it(`${ui} on ${bg} >= ${MIN_UI}`, () => expect(contrast(t[ui] ?? '', t[bg] ?? '')).toBeGreaterThanOrEqual(MIN_UI))
      }
    }
  })
}

const parsed = blocks(css)

describe('contrast maths', () => {
  it('matches known values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrast('#6B625C', '#FBF9F6')).toBeCloseTo(5.67, 1) // admin muted on bg (computed earlier by hand)
    expect(contrast('#C9A227', '#FBF8F3')).toBeLessThan(3) // why accent cannot be text on the storefront
  })
  it('mixes in sRGB like CSS color-mix', () => {
    expect(mix('#000000', '#FFFFFF', 50)).toBe('#808080')
    expect(mix('#FF0000', '#0000FF', 100)).toBe('#FF0000')
  })
})

describe('tokens.css blocks are parsed', () => {
  it('finds the three brand blocks with all semantic colors', () => {
    expect([...parsed.keys()].sort()).toEqual(['[data-brand="admin-burgundy"]', '[data-brand="admin-burgundy"][data-theme="dark"]', '[data-brand="storefront"]'])
    for (const [, vars] of parsed) expect(Object.keys(vars)).toEqual(expect.arrayContaining([...TEXT_ON_BG, ...BACKGROUNDS, 'on-accent', 'accent', 'line-strong', 'focus']))
  })
})

gate('admin light (tokens.css)', parsed.get('[data-brand="admin-burgundy"]') ?? {})
gate('admin dark (tokens.css)', parsed.get('[data-brand="admin-burgundy"][data-theme="dark"]') ?? {})
gate('storefront default (tokens.css)', parsed.get('[data-brand="storefront"]') ?? {})
for (const [id, theme] of Object.entries(themePresets)) gate(`preset ${id}`, resolveColors(theme.colors))

describe('single source for the storefront default', () => {
  it('the storefront block in tokens.css equals the storefront-gold preset', () => {
    const fromPreset = resolveColors(themePresets['storefront-gold'].colors)
    const fromCss = parsed.get('[data-brand="storefront"]') ?? {}
    for (const k of ['bg', 'surface', 'surface-2', 'fg', 'fg-soft', 'muted', 'line', 'line-strong', 'accent', 'on-accent', 'accent-text', 'accent-soft', 'sale', 'success', 'warning', 'danger', 'focus']) {
      expect(fromCss[k], k).toBe(fromPreset[k])
    }
  })
})

describe('derived colors for a custom theme', () => {
  it('falls back to readable accent text when the accent fails contrast', () => {
    const colors = /** @type {Record<string, string>} */ ({ ...themePresets['storefront-gold'].colors })
    delete colors['accentText']
    const r = resolveColors(/** @type {never} */ (colors))
    expect(r['accent-text']).toBe(colors['fg'])
    expect(contrast(r['accent-text'] ?? '', colors['bg'] ?? '')).toBeGreaterThanOrEqual(MIN_TEXT)
  })
})

describe('themeCss', () => {
  it('emits only validated values', () => {
    const out = themeCss(themePresets.botanical)
    expect(out).toContain('--sem-accent:#3F5A46')
    expect(out).toContain('--sem-font-heading:"Playfair Display", Georgia, serif')
    expect(out.startsWith(':root[data-brand="storefront"]{')).toBe(true)
  })
  it('falls back to the default theme for a hostile one (CSS injection)', () => {
    const hostile = { ...themePresets.botanical, colors: { ...themePresets.botanical.colors, accent: 'red;}body{display:none' } }
    const out = themeCss(hostile)
    expect(out).not.toContain('display:none')
    expect(out).toContain('--sem-accent:#C9A227')
  })
  it('sets control height from density', () => {
    expect(themeCss({ ...themePresets.monochrome, density: 'compact' })).toContain('--control-h:2.5rem')
  })
})

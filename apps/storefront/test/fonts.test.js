// M5-11: which font files a page asks for (plan/06-storefront/10-performance.md section 4). Needs no server.
import { describe, expect, it } from 'vitest'
import { fontsFor } from '../app/lib/fonts.server'

const theme = { heading: 'Playfair Display', body: 'Inter' }

describe('the fonts of a page', () => {
  it('an English page declares the two families of its theme and starts both files early', () => {
    const { css, preload } = fontsFor(theme, 'en')
    expect(css).toContain('font-family:"Playfair Display"')
    expect(css).toContain('font-family:"Inter"')
    expect(css).toContain('font-family:"Inter Fallback"')
    expect(css).not.toContain('Noto Nastaliq')
    expect(css.match(/font-display:swap/g)).toHaveLength(2)
    expect(preload).toHaveLength(2)
  })
  it('a theme with one family for both asks for it once', () => {
    const { css, preload } = fontsFor({ heading: 'Instrument Sans', body: 'Instrument Sans' }, 'en')
    expect(css.match(/font-family:"Instrument Sans";font-style/g)).toHaveLength(1)
    expect(css).not.toContain('Fallback') // no measured stand-in face for it
    expect(preload).toHaveLength(1)
  })
  it('an Urdu page also declares the Urdu face, in its own two ranges, and starts only that file', () => {
    const { css, preload } = fontsFor(theme, 'ur')
    expect(css).toContain('font-family:"Noto Nastaliq Urdu"')
    expect(css.match(/font-family:"Noto Nastaliq Urdu"/g)).toHaveLength(2)
    expect(preload).toHaveLength(1)
    expect(preload[0]).toContain('noto-nastaliq-urdu-arabic')
  })
  it('a name that is not one of ours reaches nothing', () => {
    const { css, preload } = fontsFor({ heading: '"};body{display:none', body: 'Comic Sans' }, 'en')
    expect(css).toBe('')
    expect(preload).toEqual([])
  })
})

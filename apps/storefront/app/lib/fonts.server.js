// The shop's fonts, self-hosted (plan/06-storefront/10-performance.md section 4, DOC-04a section 7): a page asks for the files of the two families its theme names, and on an Urdu page the Urdu
// one. Each file is a variable woff2 of one subset, so one file covers every weight. Never imported by browser code.
import instrumentSans from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url'
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import urduArabic from '@fontsource-variable/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-wght-normal.woff2?url'
import urduLatin from '@fontsource-variable/noto-nastaliq-urdu/files/noto-nastaliq-urdu-latin-wght-normal.woff2?url'
import playfair from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url'

// the ranges the font packages give their Latin and Arabic subsets: a page of Urdu text never fetches the Latin file for a digit it does not use
const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const arabic = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC'

/** @type {Record<string, { files: { url: string, range: string }[], weights: string, fallback?: string }>} */
const families = {
  Inter: { files: [{ url: inter, range: latin }], weights: '100 900', fallback: 'size-adjust:107.1%;ascent-override:90.2%;descent-override:22.5%;line-gap-override:0%' },
  'Playfair Display': { files: [{ url: playfair, range: latin }], weights: '400 900' },
  'Instrument Sans': { files: [{ url: instrumentSans, range: latin }], weights: '400 700' },
  'Noto Nastaliq Urdu': { files: [{ url: urduArabic, range: arabic }, { url: urduLatin, range: latin }], weights: '400 700' },
}

/**
 * The font CSS of a page and the files to start fetching at once.
 * `Inter` has a stand-in face with Arial's glyphs sized like it, so the swap does not move the layout; the other families have none yet (their metrics are not measured).
 * @param {{ heading: string, body: string }} theme the families the theme names
 * @param {'en' | 'ur'} locale
 * @returns {{ css: string, preload: string[] }}
 */
export function fontsFor(theme, locale) {
  const names = [...new Set([theme.heading, theme.body, ...(locale === 'ur' ? ['Noto Nastaliq Urdu'] : [])])].filter((n) => n in families)
  const css = names
    .flatMap((name) => {
      const f = /** @type {NonNullable<typeof families[string]>} */ (families[name])
      const faces = f.files.map((x) => `@font-face{font-family:"${name}";font-style:normal;font-weight:${f.weights};font-display:swap;src:url(${x.url}) format("woff2");unicode-range:${x.range}}`)
      return f.fallback ? [...faces, `@font-face{font-family:"${name} Fallback";src:local("Arial");${f.fallback}}`] : faces
    })
    .join('')
  // only the Latin or the Arabic file of the page's first family is worth a preload; the others start when text needs them
  const first = locale === 'ur' ? families['Noto Nastaliq Urdu'] : families[theme.body]
  return { css, preload: [...new Set([first?.files[0]?.url, locale === 'ur' ? undefined : families[theme.heading]?.files[0]?.url].filter((u) => typeof u === 'string'))] }
}

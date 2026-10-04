// Store theme -> CSS (plan/04-design-system/tokens.md section 6). The storefront's root loader and the admin's
// Appearance preview both call themeCss(), so what is previewed is what ships.
// Every value that reaches the CSS is a validated hex, a looked-up enum value or a fixed font stack: admin-supplied
// text is never interpolated (prevents CSS injection).
import { ThemeTokens, resolveColors, themePresets } from '@noor/contract'

export { deriveColors, resolveColors } from '@noor/contract'

const fontStack = /** @type {const} */ ({
  'Playfair Display': '"Playfair Display", Georgia, serif',
  Inter: '"Inter", system-ui, sans-serif',
  'Instrument Sans': '"Instrument Sans", system-ui, sans-serif',
})

const radius = /** @type {const} */ ({
  control: { sharp: '0', soft: '6px', round: '9999px' },
  card: { sharp: '0', soft: '10px', round: '16px' },
  media: { none: '0', soft: '8px' },
})

const controlHeight = /** @type {const} */ ({ comfortable: '2.75rem', compact: '2.5rem' })

/**
 * CSS for a theme. An invalid theme (hostile or corrupt) falls back to `fallback` rather than reaching the page.
 * @param {unknown} theme
 * @param {ThemeTokens} [fallback]
 * @returns {string}
 */
export function themeCss(theme, fallback = themePresets['storefront-gold']) {
  const parsed = ThemeTokens.safeParse(theme)
  const t = parsed.success ? parsed.data : fallback
  const vars = Object.entries(resolveColors(t.colors)).map(([k, v]) => `--sem-${k}:${v}`)
  vars.push(
    `--sem-font-heading:${fontStack[t.fonts.heading]}`,
    `--sem-font-body:${fontStack[t.fonts.body]}`,
    `--sem-radius-control:${radius.control[t.radius.control]}`,
    `--sem-radius-card:${radius.card[t.radius.card]}`,
    `--sem-radius-media:${radius.media[t.radius.media]}`,
    `--media-ratio:${t.mediaRatio}`,
    `--control-h:${controlHeight[t.density]}`,
  )
  return `:root[data-brand="storefront"]{${vars.join(';')}}`
}

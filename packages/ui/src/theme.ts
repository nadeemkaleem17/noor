// Store theme -> CSS (plan/04-design-system/tokens.md section 6). The storefront's root loader and the admin's
// Appearance preview both call themeCss(), so what is previewed is what ships.
// Every value that reaches the CSS is a validated hex, a looked-up enum value or a fixed font stack: admin-supplied
// text is never interpolated (prevents CSS injection).
import { ThemeTokens, themePresets } from '@noor/contract'
import { MIN_TEXT, contrast, mix } from './contrast'

type Colors = ThemeTokens['colors']

/** The colors a theme does not name are derived, as literal hex so the CSS and the contrast gate see the same values. */
export function deriveColors(c: Colors) {
  return {
    surface2: c.surface2 ?? mix(c.fg, c.bg, 4),
    fgSoft: c.fgSoft ?? mix(c.fg, c.bg, 80),
    lineStrong: c.lineStrong ?? mix(c.fg, c.bg, 50),
    accentText: c.accentText ?? (contrast(c.accent, c.bg) >= MIN_TEXT ? c.accent : c.fg),
    accentSoft: c.accentSoft ?? mix(c.accent, c.bg, 10),
    onAccent: c.onAccent ?? (contrast('#FFFFFF', c.accent) >= contrast('#000000', c.accent) ? '#FFFFFF' : '#000000'),
    successSoft: mix(c.success, c.bg, 12),
    warningSoft: mix(c.warning, c.bg, 12),
    dangerSoft: mix(c.danger, c.bg, 12),
  }
}

/** Every semantic color of a theme, by token name (without the `--sem-` prefix). */
export function resolveColors(c: Colors): Record<string, string> {
  const d = deriveColors(c)
  return {
    bg: c.bg, surface: c.surface, 'surface-2': d.surface2, fg: c.fg, 'fg-soft': d.fgSoft, muted: c.muted,
    line: c.line, 'line-strong': d.lineStrong, accent: c.accent, 'on-accent': d.onAccent, 'accent-text': d.accentText,
    'accent-soft': d.accentSoft, sale: c.sale, success: c.success, warning: c.warning, danger: c.danger,
    'success-soft': d.successSoft, 'warning-soft': d.warningSoft, 'danger-soft': d.dangerSoft, focus: c.focus,
  }
}

const fontStack = {
  'Playfair Display': '"Playfair Display", Georgia, serif',
  Inter: '"Inter", system-ui, sans-serif',
  'Instrument Sans': '"Instrument Sans", system-ui, sans-serif',
} as const

const radius = {
  control: { sharp: '0', soft: '6px', round: '9999px' },
  card: { sharp: '0', soft: '10px', round: '16px' },
  media: { none: '0', soft: '8px' },
} as const

const controlHeight = { comfortable: '2.75rem', compact: '2.5rem' } as const

/** CSS for a theme. An invalid theme (hostile or corrupt) falls back to `fallback` rather than reaching the page. */
export function themeCss(theme: unknown, fallback: ThemeTokens = themePresets['storefront-gold']): string {
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

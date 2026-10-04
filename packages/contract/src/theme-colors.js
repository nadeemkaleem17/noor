// The colours of a store theme as the storefront uses them, and the contrast gate over them (plan/04-design-system/tokens.md sections 6 and 9).
// Lives in the contract so the admin Appearance page, the CSS builder and the API's `theme_contrast_failed` check run the same code.
import { MIN_TEXT, MIN_UI, contrast, mix } from './contrast.js'

/**
 * @typedef {import('./primitives.js').ThemeTokens['colors']} Colors
 */

/**
 * The colors a theme does not name are derived, as literal hex so the CSS and the contrast gate see the same values.
 * @param {Colors} c
 */
export function deriveColors(c) {
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

/**
 * Every semantic color of a theme, by token name (without the `--sem-` prefix).
 * @param {Colors} c
 * @returns {Record<string, string>}
 */
export function resolveColors(c) {
  const d = deriveColors(c)
  return {
    bg: c.bg, surface: c.surface, 'surface-2': d.surface2, fg: c.fg, 'fg-soft': d.fgSoft, muted: c.muted,
    line: c.line, 'line-strong': d.lineStrong, accent: c.accent, 'on-accent': d.onAccent, 'accent-text': d.accentText,
    'accent-soft': d.accentSoft, sale: c.sale, success: c.success, warning: c.warning, danger: c.danger,
    'success-soft': d.successSoft, 'warning-soft': d.warningSoft, 'danger-soft': d.dangerSoft, focus: c.focus,
  }
}

const TEXT_ON_BG = ['fg', 'fg-soft', 'muted', 'accent-text', 'sale', 'success', 'warning', 'danger']
const BACKGROUNDS = ['bg', 'surface', 'surface-2']

/**
 * The text and control pairs of a theme that are too faint: text >= 4.5:1, borders and focus >= 3:1 (tokens.md section 9).
 * Empty means the theme passes.
 * @param {Colors} colors
 * @returns {{ pair: string, ratio: number, min: number }[]}
 */
export function contrastFailures(colors) {
  const t = resolveColors(colors)
  /** @type {{ pair: string, ratio: number, min: number }[]} */
  const out = []
  /** @param {string} fg @param {string} bg @param {number} min */
  const check = (fg, bg, min) => {
    const ratio = contrast(t[fg] ?? '', t[bg] ?? '')
    if (ratio < min) out.push({ pair: `${fg}/${bg}`, ratio: Math.round(ratio * 100) / 100, min })
  }
  for (const fg of TEXT_ON_BG) for (const bg of BACKGROUNDS) check(fg, bg, MIN_TEXT)
  check('on-accent', 'accent', MIN_TEXT)
  for (const soft of ['success-soft', 'warning-soft', 'danger-soft', 'accent-soft']) check('fg', soft, MIN_TEXT)
  for (const ui of ['line-strong', 'focus']) for (const bg of ['bg', 'surface']) check(ui, bg, MIN_UI)
  return out
}

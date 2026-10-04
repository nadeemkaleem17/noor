// The built-in storefront themes (plan/04-design-system/tokens.md section 4.2). They are ThemeTokens objects, applied
// through the same path as a custom theme: there is one code path. Values are contrast-checked by @noor/ui's gate.

const status = /** @type {const} */ ({ sale: '#B23A2E', success: '#2F6B40', warning: '#855B1A', danger: '#B23A2E', focus: '#2C3E8C' })
const base = /** @type {const} */ ({
  fonts: { heading: 'Playfair Display', body: 'Inter' },
  radius: { control: 'soft', card: 'soft', media: 'none' },
  density: 'comfortable',
  mediaRatio: '3/4',
  header: { layout: 'left', sticky: true },
})

export const themePresets = /** @satisfies {Record<string, import('./primitives.js').ThemeTokens>} */ (/** @type {const} */ ({
  'storefront-gold': {
    ...base,
    preset: 'storefront-gold',
    colors: {
      bg: '#FBF8F3', surface: '#FFFFFF', surface2: '#F4EFE6', fg: '#141210', fgSoft: '#3D3832', muted: '#6A6359',
      line: '#E7E0D4', lineStrong: '#8C8279', accent: '#C9A227', onAccent: '#1A1408', accentText: '#806010', accentSoft: '#FBF6E8', ...status,
    },
  },
  monochrome: {
    ...base,
    preset: 'monochrome',
    colors: {
      bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F4F3F1', fg: '#141210', fgSoft: '#3D3832', muted: '#6B6B6B',
      line: '#DEDCD8', lineStrong: '#8C8279', accent: '#221F1C', onAccent: '#FFFFFF', accentText: '#221F1C', accentSoft: '#F4F3F1', ...status,
    },
  },
  botanical: {
    ...base,
    preset: 'botanical',
    colors: {
      bg: '#F6F3EA', surface: '#FFFFFF', surface2: '#EFF3EA', fg: '#23281F', fgSoft: '#3A4136', muted: '#5F6858',
      line: '#DCE3D4', lineStrong: '#8C8279', accent: '#3F5A46', onAccent: '#FFFFFF', accentText: '#3F5A46', accentSoft: '#EFF3EA', ...status,
      sale: '#A04A22',
    },
  },
}))

/**
 * @typedef {keyof typeof themePresets} ThemePresetId
 */

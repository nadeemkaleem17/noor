// The built-in storefront themes (plan/04-design-system/tokens.md section 4.2). They are ThemeTokens objects, applied
// through the same path as a custom theme: there is one code path. Values are contrast-checked by @noor/ui's gate.

const status = /** @type {const} */ ({ sale: '#B23A2E', success: '#2F6B40', warning: '#855B1A', danger: '#B23A2E', focus: '#2C3E8C' })
const atelierStatus = /** @type {const} */ ({ ...status, sale: '#A8302A', danger: '#A8302A' })
const base = /** @type {const} */ ({
  fonts: { heading: 'Playfair Display', body: 'Inter' },
  radius: { control: 'soft', card: 'soft', media: 'none' },
  density: 'comfortable',
  mediaRatio: '3/4',
  header: { layout: 'left', sticky: true },
})

export const themePresets = /** @satisfies {Record<string, import('./primitives.js').ThemeTokens>} */ (/** @type {const} */ ({
  // Atelier (DOC-06.15 section 4.2): paper page, ink primary button, gold only as accent text and soft highlights. The default of a new shop.
  atelier: {
    ...base,
    preset: 'atelier',
    colors: {
      bg: '#FBF8F3', surface: '#FFFFFF', surface2: '#F4EFE6', fg: '#141210', fgSoft: '#3D3832', muted: '#5E574D',
      line: '#E7E0D4', lineStrong: '#7C7368', accent: '#141210', onAccent: '#FFFFFF', accentText: '#7A5C0B', accentSoft: '#FBF6E8', ...atelierStatus,
    },
  },
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
  // Added 2026-10-20 (plan/17 item 12). Each differs in colour and in shape (radius, fonts, header, picture ratio), not only in tint.
  'rose-garden': {
    ...base, preset: 'rose-garden', radius: { control: 'round', card: 'soft', media: 'soft' }, mediaRatio: '4/5',
    colors: { bg: '#FBF4F4', surface: '#FFFFFF', surface2: '#F6E9EA', fg: '#2A1B1E', fgSoft: '#4A363A', muted: '#6B565B', line: '#EBD8DA', lineStrong: '#85676D', accent: '#9E3B54', onAccent: '#FFFFFF', accentText: '#8A2F47', accentSoft: '#F9E8EC', ...status },
  },
  midnight: {
    ...base, preset: 'midnight', fonts: { heading: 'Instrument Sans', body: 'Inter' }, radius: { control: 'soft', card: 'soft', media: 'soft' }, header: { layout: 'center', sticky: true },
    colors: { bg: '#14110F', surface: '#1C1816', surface2: '#26211E', fg: '#F5EFE6', fgSoft: '#D9D0C3', muted: '#A89F92', line: '#2F2924', lineStrong: '#7D7468', accent: '#D9B25F', onAccent: '#1A1408', accentText: '#E3C27A', accentSoft: '#2A2314', sale: '#F28B7D', success: '#7FC08F', warning: '#E0B661', danger: '#F28B7D', focus: '#8FA8FF' },
  },
  emerald: {
    ...base, preset: 'emerald',
    colors: { bg: '#F4F8F5', surface: '#FFFFFF', surface2: '#E8F1EB', fg: '#10231A', fgSoft: '#2E4538', muted: '#52695B', line: '#D3E2D8', lineStrong: '#6E8576', accent: '#14693F', onAccent: '#FFFFFF', accentText: '#14693F', accentSoft: '#E3F1E8', ...status },
  },
  sandstone: {
    ...base, preset: 'sandstone', radius: { control: 'sharp', card: 'sharp', media: 'none' },
    colors: { bg: '#FAF5EF', surface: '#FFFFFF', surface2: '#F2E8DC', fg: '#2B1D14', fgSoft: '#4D382A', muted: '#6F5646', line: '#E6D6C4', lineStrong: '#8A6F5C', accent: '#A64B2A', onAccent: '#FFFFFF', accentText: '#8F3E20', accentSoft: '#F8E7DC', ...status },
  },
  ocean: {
    ...base, preset: 'ocean', fonts: { heading: 'Instrument Sans', body: 'Instrument Sans' }, radius: { control: 'sharp', card: 'soft', media: 'none' }, mediaRatio: '2/3',
    colors: { bg: '#F5F8FB', surface: '#FFFFFF', surface2: '#E9EFF6', fg: '#0F1D2E', fgSoft: '#2D3F55', muted: '#4F6178', line: '#D5DFEA', lineStrong: '#6B7F96', accent: '#1F4E8C', onAccent: '#FFFFFF', accentText: '#1F4E8C', accentSoft: '#E4EDF8', ...status },
  },
  lavender: {
    ...base, preset: 'lavender', radius: { control: 'round', card: 'round', media: 'soft' },
    colors: { bg: '#F8F6FC', surface: '#FFFFFF', surface2: '#EEEAF7', fg: '#1E1A2E', fgSoft: '#3B3556', muted: '#5E5778', line: '#DDD7EE', lineStrong: '#7A7396', accent: '#5B3FA0', onAccent: '#FFFFFF', accentText: '#5B3FA0', accentSoft: '#ECE6F8', ...status },
  },
  saffron: {
    ...base, preset: 'saffron', mediaRatio: '4/5',
    colors: { bg: '#FFFAF0', surface: '#FFFFFF', surface2: '#FBF0DA', fg: '#2A1D08', fgSoft: '#4D3A17', muted: '#6E5A32', line: '#EEDFC0', lineStrong: '#8C7648', accent: '#9A4F06', onAccent: '#FFFFFF', accentText: '#8F4A06', accentSoft: '#FBEBD3', ...status },
  },
  slate: {
    ...base, preset: 'slate', fonts: { heading: 'Inter', body: 'Inter' }, density: 'compact', header: { layout: 'center', sticky: true }, radius: { control: 'soft', card: 'sharp', media: 'none' }, mediaRatio: '1/1',
    colors: { bg: '#F7F8F9', surface: '#FFFFFF', surface2: '#ECEFF2', fg: '#14181C', fgSoft: '#363E46', muted: '#58626C', line: '#DADFE4', lineStrong: '#76808A', accent: '#2B3A47', onAccent: '#FFFFFF', accentText: '#2B3A47', accentSoft: '#E8ECF0', ...status },
  },
}))

/**
 * @typedef {keyof typeof themePresets} ThemePresetId
 */

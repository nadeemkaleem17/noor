// Small shared schemas used by many routes (plan/10-api/00-conventions.md sections 4-5).
import { z } from 'zod'
import { Enum } from './enums'

export const Id = z.uuid()
export type Id = z.infer<typeof Id>

/** ISO 8601 UTC timestamp string, e.g. 2026-10-02T10:45:00.000Z. */
export const IsoDate = z.iso.datetime()
export type IsoDate = z.infer<typeof IsoDate>

export const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'color_invalid')

/** An image as the API returns it: ready-made src and srcset; clients never build transform URLs (DOC-08 section 11). */
export const Image = z.strictObject({
  src: z.string().min(1),
  srcset: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  lqip: z.string().optional(),
})
export type Image = z.infer<typeof Image>

export const Swatch = z.union([
  z.strictObject({ hex: z.array(HexColor).min(1).max(2) }),
  z.strictObject({ mediaId: Id }),
])
export type Swatch = z.infer<typeof Swatch>

export const ColorFamily = Enum.colorFamily

export const LineCustomization = z.strictObject({
  measurements: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  notes: z.string().max(500).optional(),
  bundle: z.array(z.strictObject({ productId: Id, variantId: Id })).optional(),
})
export type LineCustomization = z.infer<typeof LineCustomization>

export const FormField = z.strictObject({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,29}$/, 'handle_invalid'),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'tel', 'email', 'number', 'select', 'textarea', 'checkbox']),
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  pattern: z.string().optional(),
  options: z.array(z.strictObject({ value: z.string(), label: z.string() })).optional(),
  unit: z.enum(['in', 'cm']).optional(),
  helpText: z.string().optional(),
})
export type FormField = z.infer<typeof FormField>

export const FormSchema = z.strictObject({
  id: Id.optional(),
  title: z.string().optional(),
  fields: z.array(FormField),
  allowNotes: z.boolean().optional(),
})
export type FormSchema = z.infer<typeof FormSchema>

/** The fonts the storefront self-hosts; the only values a theme may name (DOC-04a sections 6-7). */
export const themeFonts = ['Playfair Display', 'Inter', 'Instrument Sans'] as const

/** Store theme (DOC-04a section 6). Every colour is a 6-digit hex, validated here and again before it reaches CSS. */
export const ThemeTokens = z.strictObject({
  preset: z.string().optional(),
  colors: z.strictObject({
    bg: HexColor, surface: HexColor, fg: HexColor, muted: HexColor, line: HexColor, accent: HexColor,
    onAccent: HexColor.optional(), sale: HexColor, success: HexColor, warning: HexColor, danger: HexColor, focus: HexColor,
    // Optional overrides of the colors the UI otherwise derives (DOC-04a section 6). Presets set them to keep the brand look.
    surface2: HexColor.optional(), fgSoft: HexColor.optional(), lineStrong: HexColor.optional(),
    accentText: HexColor.optional(), accentSoft: HexColor.optional(),
  }),
  fonts: z.strictObject({ heading: z.enum(themeFonts), body: z.enum(themeFonts) }),
  radius: z.strictObject({
    control: z.enum(['sharp', 'soft', 'round']),
    card: z.enum(['sharp', 'soft', 'round']),
    media: z.enum(['none', 'soft']),
  }),
  density: z.enum(['comfortable', 'compact']),
  mediaRatio: z.enum(['3/4', '2/3', '4/5', '1/1']),
  header: z.strictObject({ layout: z.enum(['left', 'center']), sticky: z.boolean() }),
})
export type ThemeTokens = z.infer<typeof ThemeTokens>

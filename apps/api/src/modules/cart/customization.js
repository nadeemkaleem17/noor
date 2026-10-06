// What a customer may attach to a cart line (plan/09-data-model/06-cart-promotions.md section 2.2): custom-size measurements, a note, the chosen
// variants of a bundle. Pure; the database facts (the product's form, its bundle children) are handed in.
import { createHash } from 'node:crypto'

/**
 * @typedef {import('@noor/contract').LineCustomization} LineCustomization
 * @typedef {{ path: string, code: 'required' | 'invalid_format' | 'too_small' | 'too_big' | 'too_long' | 'not_unique' }} Issue
 */

/** Nothing but an empty object is "no customisation", so it cannot make a second line of the same variant. @param {LineCustomization | undefined} c @returns {LineCustomization | undefined} */
export function normalise(c) {
  if (!c) return undefined
  const measurements = c.measurements && Object.keys(c.measurements).length ? c.measurements : undefined
  const notes = c.notes?.trim() || undefined
  const bundle = c.bundle?.length ? c.bundle : undefined
  if (!measurements && !notes && !bundle) return undefined
  return { ...(measurements ? { measurements } : {}), ...(notes ? { notes } : {}), ...(bundle ? { bundle } : {}) }
}

/** @param {unknown} v @returns {unknown} keys in a fixed order at every level, so the same choices always give the same text */
const sorted = (v) =>
  Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sorted(x)])) : v

/** SHA-256 of the canonical customisation; empty when there is none. Part of a line's identity (ADR-0014). @param {LineCustomization | undefined} c */
export const customizationHash = (c) => (c ? createHash('sha256').update(JSON.stringify(sorted(c))).digest('hex') : '')

/**
 * Answers checked against a form's fields (the custom-size form of a product, the extra fields of the checkout): each field present or missing as it requires,
 * numbers within their range, a select from its options, text not too long, and no answer to a field the form does not have.
 * @param {import('@noor/contract').FormField[]} fields
 * @param {Record<string, string | number | boolean>} answers
 * @param {string} prefix the path of the answers in the request, for the issue paths
 * @returns {Issue[]}
 */
export function fieldIssues(fields, answers, prefix) {
  /** @type {Issue[]} */
  const issues = []
  for (const key of Object.keys(answers)) if (!fields.some((f) => f.key === key)) issues.push({ path: `${prefix}.${key}`, code: 'invalid_format' })
  for (const f of fields) {
    const path = `${prefix}.${f.key}`
    const raw = answers[f.key]
    if (raw === undefined || raw === '') {
      if (f.required) issues.push({ path, code: 'required' })
      continue
    }
    if (f.type === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(n) || (typeof raw === 'string' && raw.trim() === '')) issues.push({ path, code: 'invalid_format' })
      else if (f.min !== undefined && n < f.min) issues.push({ path, code: 'too_small' })
      else if (f.max !== undefined && n > f.max) issues.push({ path, code: 'too_big' })
    } else if (f.type === 'select') {
      if (!f.options?.some((o) => o.value === String(raw))) issues.push({ path, code: 'invalid_format' })
    } else if (f.type === 'checkbox') {
      if (typeof raw !== 'boolean') issues.push({ path, code: 'invalid_format' })
    } else if (String(raw).length > 100 + (f.type === 'textarea' ? 150 : 0)) issues.push({ path, code: 'too_long' })
  }
  return issues
}

/**
 * @param {LineCustomization | undefined} c already normalised
 * @param {{ fields: import('@noor/contract').FormField[]; allowNotes: boolean; bundleChildIds: string[] | null }} rules
 *   `fields`: the product's custom-size form (empty when it has none); `bundleChildIds`: the children of a bundle product, `null` for any other
 * @returns {Issue[]}
 */
export function customizationIssues(c, { fields, allowNotes, bundleChildIds }) {
  const issues = fieldIssues(fields, c?.measurements ?? {}, 'customization.measurements')
  if (c?.notes && !allowNotes) issues.push({ path: 'customization.notes', code: 'invalid_format' })

  if (bundleChildIds === null) {
    if (c?.bundle) issues.push({ path: 'customization.bundle', code: 'invalid_format' })
  } else if (bundleChildIds.length) {
    const chosen = c?.bundle ?? []
    if (!chosen.length) issues.push({ path: 'customization.bundle', code: 'required' })
    chosen.forEach((b, i) => {
      if (!bundleChildIds.includes(b.productId)) issues.push({ path: `customization.bundle.${i}.productId`, code: 'invalid_format' })
      else if (chosen.findIndex((x) => x.productId === b.productId) !== i) issues.push({ path: `customization.bundle.${i}.productId`, code: 'not_unique' })
    })
    if (chosen.length && bundleChildIds.some((id) => !chosen.some((b) => b.productId === id))) issues.push({ path: 'customization.bundle', code: 'required' })
  }
  return issues
}

/** "chest 38 in, waist 32 in; Kurta (M), Dupatta (Free size)": the customisation as a person reads it. @param {LineCustomization | undefined} c @param {import('@noor/contract').FormField[]} fields @param {ReadonlyMap<string, string>} bundleLabels by variant id */
export function customizationSummary(c, fields, bundleLabels) {
  if (!c) return undefined
  const parts = Object.entries(c.measurements ?? {}).map(([k, v]) => {
    const f = fields.find((x) => x.key === k)
    return `${f?.label ?? k} ${v}${f?.unit ? ` ${f.unit}` : ''}`
  })
  const bundle = (c.bundle ?? []).map((b) => bundleLabels.get(b.variantId)).filter(Boolean)
  const text = [parts.join(', '), bundle.join(', ')].filter(Boolean).join('; ')
  return text || undefined
}

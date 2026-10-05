// Glue between react-hook-form and the contract's Zod schemas (plan/05-react-patterns.md section 3).
import { toFieldIssues } from '@noor/contract'
import { set } from 'react-hook-form'

/**
 * A resolver whose error messages are the contract's field issue codes (`required`, `too_long`, ...), which `RHFField` translates.
 * @param {import('@noor/contract').z.ZodType} schema
 * @param {(values: any) => unknown} [prepare] - what to validate instead of the raw form values (empty strings left out, for instance)
 * @returns {import('react-hook-form').Resolver<any>}
 */
export const contractResolver = (schema, prepare = (/** @type {unknown} */ v) => v) => async (values) => {
  const result = schema.safeParse(prepare(values))
  if (result.success) return { values, errors: {} }
  const errors = {}
  for (const issue of toFieldIssues(result.error)) if (!(issue.path in errors)) set(errors, issue.path, { type: issue.code, message: issue.code })
  return { values: {}, errors }
}

/**
 * What the API gets: empty strings, empty lists of optional things and empty objects are left out, so "not filled in" is never sent as a value.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function prune(value) {
  if (Array.isArray(value)) return /** @type {T} */ (/** @type {unknown} */ (value.map(prune)))
  if (value && typeof value === 'object') {
    const out = /** @type {Record<string, unknown>} */ ({})
    for (const [k, v] of Object.entries(value)) {
      const p = prune(v)
      const empty = p === '' || p === undefined || p === null || (typeof p === 'object' && !Array.isArray(p) && Object.keys(/** @type {object} */ (p)).length === 0)
      if (!empty) out[k] = p
    }
    return /** @type {T} */ (/** @type {unknown} */ (out))
  }
  return value
}

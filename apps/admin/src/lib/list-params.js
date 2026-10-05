// URL state of a list screen (plan/07-admin/14-tables-bulk.md section 3): the address holds search, filters, sort, page and page size.
import { useSearchParams } from 'react-router'

/**
 * Reads list parameters from a query string with the screen's Zod schema. A value that does not parse is dropped, not an error.
 * @template {import('@noor/contract').z.ZodType} S
 * @param {S} schema
 * @param {URLSearchParams} search
 * @returns {import('@noor/contract').z.output<S>}
 */
export function parseListParams(schema, search) {
  const raw = /** @type {Record<string, string>} */ (Object.fromEntries(search))
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = schema.safeParse(raw)
    if (result.success) return result.data
    for (const issue of result.error.issues) {
      if (issue.code === 'unrecognized_keys') for (const key of issue.keys) delete raw[key]
      else if (typeof issue.path[0] === 'string') delete raw[issue.path[0]]
      else return schema.parse({}) // an issue that names no key (a schema-wide rule): start from the defaults
    }
  }
  return schema.parse({})
}

/** A value as it is written in the address: arrays as "a,b". @param {unknown} value */
const written = (value) => (Array.isArray(value) ? value.join(',') : String(value))

/**
 * What the address becomes after `patch`. Values equal to the schema default, or empty, leave the address;
 * anything but a page change sends the list back to page 1.
 * @param {URLSearchParams} current
 * @param {Record<string, unknown>} patch
 * @param {Record<string, unknown>} defaults
 */
export function nextSearch(current, patch, defaults) {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || written(value) === written(defaults[key] ?? '\u0000')) next.delete(key)
    else next.set(key, written(value))
  }
  if (!('page' in patch)) next.delete('page')
  return next
}

/**
 * @template {import('@noor/contract').z.ZodType} S
 * @param {S} schema
 * @returns {{ params: import('@noor/contract').z.output<S>; set: (patch: Record<string, unknown>, options?: { replace?: boolean }) => void; }}
 */
export function useListParams(schema) {
  const [search, setSearch] = useSearchParams()
  const params = parseListParams(schema, search)
  const defaults = /** @type {Record<string, unknown>} */ (parseListParams(schema, new URLSearchParams()))
  return {
    params,
    // typing replaces the history entry; a discrete choice (filter, sort, page) adds one, so Back undoes it
    set: (patch, { replace = false } = {}) => setSearch((current) => nextSearch(current, patch, defaults), { replace }),
  }
}

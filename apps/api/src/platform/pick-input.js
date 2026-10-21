// What a Zod schema keeps of a value: its own keys, all the way down. An admin view of a record has everything its input has and more (ids, counts, links); picking by the input's schema gives back
// what `create` takes. Used to keep a deleted record in the trash, and to make it again.

/**
 * @param {import('@noor/contract').z.ZodType} schema
 * @param {unknown} value
 * @returns {unknown}
 */
export function pickInput(schema, value) {
  const def = /** @type {{ type?: string, shape?: Record<string, import('@noor/contract').z.ZodType>, element?: import('@noor/contract').z.ZodType, innerType?: import('@noor/contract').z.ZodType, in?: import('@noor/contract').z.ZodType }} */ (
    /** @type {{ _zod?: { def?: object } }} */ (schema)._zod?.def ?? {}
  )
  if (value === null || typeof value !== 'object') return value
  switch (def.type) {
    case 'object': {
      /** @type {Record<string, unknown>} */
      const out = {}
      const from = /** @type {Record<string, unknown>} */ (value)
      for (const [key, inner] of Object.entries(def.shape ?? {})) if (from[key] !== undefined) out[key] = pickInput(inner, from[key])
      return out
    }
    case 'array':
      return Array.isArray(value) && def.element ? value.map((v) => pickInput(/** @type {import('@noor/contract').z.ZodType} */ (def.element), v)) : value
    case 'optional':
    case 'nullable':
    case 'default':
    case 'readonly':
    case 'prefault':
    case 'nonoptional':
      return def.innerType ? pickInput(def.innerType, value) : value
    case 'pipe':
      return def.in ? pickInput(def.in, value) : value
    default:
      return value
  }
}

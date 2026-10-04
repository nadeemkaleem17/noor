// The publish checks (plan/07-admin/03-products.md section 8). One pure function: the save runs it, the checks endpoint runs it, and
// the list's "has issues" flag runs it, so they can never disagree.

/**
 * @typedef {object} CheckEnv
 * @property {ReadonlyMap<string, string>} bundleChildStatus status of each product named in `bundleProductIds`
 * @property {ReadonlySet<string>} requiredAttributeIds attributes the primary category requires (own or inherited)
 */

/**
 * Works on anything shaped like a product document: the input of a save or the admin view of a stored product.
 * @param {import('@noor/contract').ProductInput} doc
 * @param {CheckEnv} env
 * @returns {{ code: string, path?: string, ok: boolean }[]}
 */
export function publishChecks(doc, env) {
  /** @type {{ code: string, path?: string, ok: boolean }[]} */
  const out = []
  /** @param {string} code @param {boolean} ok @param {string} [path] */
  const check = (code, ok, path) => out.push({ code, ok, ...(path && !ok ? { path } : {}) })

  check('basics', !!(doc.title.trim() && doc.handle && doc.primaryCategoryId && doc.kind), doc.title.trim() ? 'handle' : 'title')

  check('images', doc.media.length > 0, 'media')
  const noAlt = doc.media.findIndex((m) => !m.alt.trim())
  check('image_alt', doc.media.length === 0 || noAlt < 0, `media.${noAlt}.alt`)

  const enabled = doc.variants.filter((v) => v.enabled)
  check('variant_enabled', enabled.length > 0, 'variants')
  const incomplete = doc.variants.findIndex((v) => v.enabled && (!v.sku.trim() || !(v.price.amount > 0)))
  check('variant_sku_price', incomplete < 0, `variants.${incomplete}`)

  if (doc.kind === 'unstitched') check('components', (doc.components?.length ?? 0) > 0, 'components')
  if (doc.kind === 'made_to_order') check('lead_time', !!doc.madeToOrder, 'madeToOrder')
  if (doc.kind === 'bundle') {
    const children = doc.bundleProductIds ?? []
    check('bundle_children', children.length >= 2 && children.every((id) => env.bundleChildStatus.get(id) === 'active'), 'bundleProductIds')
  }

  const bad = doc.variants.findIndex((v) => v.compareAt && v.compareAt.amount <= v.price.amount)
  check('compare_at', bad < 0, `variants.${bad}.compareAt`)

  if (env.requiredAttributeIds.size) {
    const filled = new Set(doc.attributes.filter((a) => (a.valueIds?.length ?? 0) > 0 || a.number !== undefined).map((a) => a.attributeId))
    check('required_attributes', [...env.requiredAttributeIds].every((id) => filled.has(id)), 'attributes')
  }
  return out
}

/** @param {{ ok: boolean }[]} checks */
export const allPass = (checks) => checks.every((c) => c.ok)

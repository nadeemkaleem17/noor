// Data health check: contract validation + reference integrity across all collections.
// data = { collections: { products: [...], ... }, singletons: { storeConfig } }  (the shape exportAll() returns)
import { collections as schemas, StoreConfig } from '../contract/schemas.js'
import { validateItem } from './validate.js'
import { membershipDrift } from './membership.js'

export function runHealthCheck(data) {
  const issues = []
  const add = (level, area, message, fix) => issues.push({ level, area, message, ...(fix ? { fix } : {}) })
  const c = data.collections || {}
  const ids = (name) => new Set((c[name] || []).map((x) => x.id))
  const label = (name, it) => `${name}/${it.handle || it.slug || it.orderNo || it.id}`

  // 1. Contract validation
  for (const name of Object.keys(schemas)) {
    for (const item of c[name] || []) {
      const r = validateItem(name, item)
      if (!r.success) r.errors.forEach((e) => add('error', 'Contract', `${label(name, item)} — ${e.path}: ${e.message}`))
    }
  }
  const sc = data.singletons?.storeConfig
  if (sc) {
    const r = StoreConfig.safeParse(sc)
    if (!r.success) r.error.issues.forEach((i) => add('error', 'Contract', `storeConfig — ${i.path.join('.')}: ${i.message}`))
  }

  // 2. References
  const cats = ids('categories'), cols = ids('collectionsList'), prods = ids('products')
  for (const p of c.products || []) {
    const at = label('products', p)
    if (p.primaryCategoryId && !cats.has(p.primaryCategoryId)) add('error', 'References', `${at} points to a missing primary category`)
    ;(p.categoryIds || []).filter((x) => !cats.has(x)).forEach((x) => add('warn', 'References', `${at} lists missing category ${x}`))
    ;(p.collectionIds || []).filter((x) => !cols.has(x)).forEach((x) => add('warn', 'References', `${at} lists missing collection ${x}`))
    ;(p.relatedIds || []).filter((x) => !prods.has(x)).forEach((x) => add('warn', 'References', `${at} lists missing related product ${x}`))
  }
  for (const cat of c.categories || []) {
    if (cat.parentId && !cats.has(cat.parentId)) add('error', 'References', `${label('categories', cat)} has a missing parent`)
  }
  for (const r of c.reviews || []) {
    if (!prods.has(r.productId)) add('warn', 'References', `review ${r.id} is for a product that no longer exists`)
  }

  // 3. Unique handles
  for (const name of ['products', 'categories', 'collectionsList', 'pages', 'menus']) {
    const seen = new Map()
    for (const it of c[name] || []) {
      const key = it.handle ?? it.slug
      if (!key) continue
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    seen.forEach((n, key) => n > 1 && add('error', 'Handles', `${name}: “${key}” is used ${n} times`))
  }

  // 4. Collection membership drift (F-17)
  const drift = membershipDrift(c.products || [], c.collectionsList || [])
  if (drift.length) add('warn', 'Collections', `${drift.length} collection(s) list different products than the products list themselves`, 'sync-collections')

  const errors = issues.filter((i) => i.level === 'error').length
  return { issues, errors, warnings: issues.length - errors, ok: issues.length === 0 }
}

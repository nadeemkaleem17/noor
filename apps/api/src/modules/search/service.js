// Text search over active products with InnoDB FULLTEXT (ADR-0010, plan/09-data-model/05-search.md). `product_search` holds one row per
// active product, rebuilt by jobs when a product or the structure around it changes; `run` is the one query every text search goes through.
import { and, eq, inArray, lt, notInArray, sql } from 'drizzle-orm'
import { now } from '../../platform/clock.js'
import { attributeValues, attributes, categories } from '../../db/schema/taxonomy.js'
import { productAttributeValues, productCategories, products, variants } from '../../db/schema/products.js'
import { productSearch, searchMisses, searchSynonyms } from '../../db/schema/search.js'
import { looksLikePhone, normalise, toExpression } from './query.js'
import { synonymSeeds } from './synonyms.js'

/** @typedef {import('../../platform/db.js').Executor} Db */

const SYNONYM_TTL_MS = 5 * 60_000
const BATCH = 200
const KARACHI_MS = 5 * 3_600_000

/** The text a description adds to the index: its first 500 characters without Markdown marks. @param {string | null} md */
const plain = (md) => (md ?? '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 */
export function createSearch({ db }) {
  /** @type {{ at: number, map: Map<string, string[]> } | null} */
  let cache = null

  /** term -> other spellings, kept for five minutes. */
  async function synonyms() {
    const at = now().getTime()
    if (cache && at - cache.at < SYNONYM_TTL_MS) return cache.map
    const rows = await db.select().from(searchSynonyms)
    cache = { at, map: new Map(rows.map((r) => [r.term, r.expandsTo.split(' ').filter(Boolean)])) }
    return cache.map
  }

  /** The search text of each product among `ids`, by id. Products that are not active get none. @param {Db} x @param {string[]} ids */
  async function documents(x, ids) {
    if (!ids.length) return new Map()
    const rows = await x.select().from(products).where(and(inArray(products.id, ids), eq(products.status, 'active')))
    const live = rows.map((r) => r.id)
    if (!live.length) return new Map()
    const [allCategories, tagged, valueRows, skuRows] = await Promise.all([
      x.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories),
      x.select().from(productCategories).where(inArray(productCategories.productId, live)),
      x
        .select({ productId: productAttributeValues.productId, label: attributeValues.label, attribute: attributes.label, type: attributes.type })
        .from(productAttributeValues)
        .innerJoin(attributeValues, eq(attributeValues.id, productAttributeValues.valueId))
        .innerJoin(attributes, eq(attributes.id, productAttributeValues.attributeId))
        .where(inArray(productAttributeValues.productId, live)),
      x.select({ productId: variants.productId, sku: variants.sku }).from(variants).where(inArray(variants.productId, live)),
    ])
    const byId = new Map(allCategories.map((c) => [c.id, c]))
    /** Category names with the names of everything above them. @param {string[]} ids */
    const names = (ids) => {
      const out = new Set()
      for (const id of ids) for (let c = byId.get(id); c; c = c.parentId ? byId.get(c.parentId) : undefined) out.add(c.name)
      return [...out]
    }
    return new Map(
      rows.map((p) => {
        const ur = /** @type {{ ur?: { title?: string } } | null} */ (p.i18n)?.ur
        const components = /** @type {{ fabric?: string, technique?: string }[] | null} */ (p.components) ?? []
        const title = [p.title, p.subtitle, p.brand, p.colorwayLabel].filter(Boolean).join(' ').slice(0, 400)
        const body = [
          ...names([p.primaryCategoryId, ...tagged.filter((t) => t.productId === p.id).map((t) => t.categoryId)]),
          ...valueRows.filter((v) => v.productId === p.id && v.type !== 'number').map((v) => v.label),
          ...components.flatMap((c) => [c.fabric, c.technique]),
          ...skuRows.filter((s) => s.productId === p.id).map((s) => s.sku),
          plain(p.descriptionMd),
          ur?.title,
        ].filter(Boolean).join(' ')
        return [p.id, { title, body }]
      }),
    )
  }

  /** Rebuilds the rows of these products: active ones are written, the others removed. @param {Db} x @param {string[]} ids */
  async function reindex(x, ids) {
    const docs = await documents(x, ids)
    const at = now()
    for (const [productId, d] of docs) {
      await x
        .insert(productSearch)
        .values({ productId, titleText: d.title, bodyText: d.body, updatedAt: at })
        .onDuplicateKeyUpdate({ set: { titleText: d.title, bodyText: d.body, updatedAt: at } })
    }
    const gone = ids.filter((id) => !docs.has(id))
    if (gone.length) await x.delete(productSearch).where(inArray(productSearch.productId, gone))
  }

  return {
    reindexProduct: (/** @type {string} */ id) => reindex(db, [id]),

    /** Every product: after a category or attribute was renamed or removed. Also drops rows of products that are no longer active. */
    async reindexAll() {
      const active = (await db.select({ id: products.id }).from(products).where(eq(products.status, 'active'))).map((p) => p.id)
      for (let i = 0; i < active.length; i += BATCH) await reindex(db, active.slice(i, i + BATCH))
      await db.delete(productSearch).where(active.length ? notInArray(productSearch.productId, active) : undefined)
      return active.length
    },

    /** Idempotent: adds spellings that are missing and leaves the others alone. */
    async seedSynonyms() {
      const have = new Set((await db.select({ term: searchSynonyms.term }).from(searchSynonyms)).map((r) => r.term))
      const missing = synonymSeeds.filter((s) => !have.has(s.term))
      if (missing.length) await db.insert(searchSynonyms).values(missing.map((s) => ({ ...s, createdAt: now() })))
      cache = null
      return missing.length
    },
    forgetSynonyms: () => void (cache = null),

    /**
     * Product ids matching a text query, best first. An exact SKU comes first. `where` adds the predicates a listing has (filters, price,
     * stock) on the `products` table. Nothing the customer typed reaches the boolean syntax, and a query with no usable word is an empty result.
     * @param {{ q: string, where?: import('drizzle-orm').SQL, limit?: number, offset?: number, logMiss?: boolean }} query
     * @returns {Promise<{ id: string, score: number }[]>}
     */
    async run({ q, where, limit = 25, offset = 0, logMiss = true }) {
      const normalised = normalise(q)
      /** @type {{ id: string, score: number }[]} */
      let found = []
      if (normalised) {
        const typed = q.trim().toUpperCase()
        // a SKU is plain ASCII; text in other scripts cannot be one (and would not compare with the binary column)
        const sku = offset === 0 && /^[A-Z0-9._-]{1,40}$/.test(typed) ? await db.select({ id: products.id }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(and(eq(variants.sku, typed), eq(products.status, 'active'), where)).limit(1) : []
        const expr = toExpression(normalised, await synonyms())
        if (expr) {
          const titleMatch = sql`match(${productSearch.titleText}) against (${expr} in boolean mode)`
          const allMatch = sql`match(${productSearch.titleText}, ${productSearch.bodyText}) against (${expr} in boolean mode)`
          const rows = await db
            .select({ id: products.id, score: sql`${titleMatch} * 3 + ${allMatch}`.mapWith(Number).as('score') })
            .from(productSearch)
            .innerJoin(products, eq(products.id, productSearch.productId))
            .where(and(eq(products.status, 'active'), allMatch, where))
            .orderBy(sql`score desc`, sql`${products.salesCount} desc`, products.id)
            .limit(limit)
            .offset(offset)
          const first = sku[0]
          found = first ? [{ id: first.id, score: Number.MAX_SAFE_INTEGER }, ...rows.filter((r) => r.id !== first.id)].slice(0, limit) : rows
        } else if (sku[0]) found = [{ id: sku[0].id, score: Number.MAX_SAFE_INTEGER }]
      }
      if (!found.length && logMiss && normalised && offset === 0 && !looksLikePhone(normalised)) {
        const day = new Date(now().getTime() + KARACHI_MS).toISOString().slice(0, 10)
        await db.insert(searchMisses).values({ day, query: normalised, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`${searchMisses.count} + 1` } })
      }
      return found
    },

    /** The most frequent queries that found nothing, for the dashboard. @param {{ days?: number, limit?: number }} [opts] */
    async topMisses({ days = 7, limit = 20 } = {}) {
      const since = new Date(now().getTime() + KARACHI_MS - days * 86_400_000).toISOString().slice(0, 10)
      return db
        .select({ query: searchMisses.query, count: sql`sum(${searchMisses.count})`.mapWith(Number) })
        .from(searchMisses)
        .where(sql`${searchMisses.day} >= ${since}`)
        .groupBy(searchMisses.query)
        .orderBy(sql`sum(${searchMisses.count}) desc`, searchMisses.query)
        .limit(limit)
    },

    /** Job `search.cleanup_misses` (daily): the log keeps 180 days. */
    async cleanupMisses() {
      const cutoff = new Date(now().getTime() + KARACHI_MS - 180 * 86_400_000).toISOString().slice(0, 10)
      await db.delete(searchMisses).where(lt(searchMisses.day, cutoff))
    },
  }
}

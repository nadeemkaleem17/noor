// Products: one document saved whole with its version (plan/10-api/05 section 2, plan/09-data-model/03-catalog.md sections 5 and 7).
// Options, option values and variants are matched by id so a save never recreates what orders and carts already point at.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, asc, count, desc, eq, inArray, like, lte, or, sql } from 'drizzle-orm'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { readyIds } from '../media/repository.js'
import { diffOf, record } from '../audit/index.js'
import { reviews } from '../../db/schema/reviews.js'
import { attributeValues, attributes, categories, formSchemas, sizeCharts, sizeSystemValues, sizeSystems } from '../../db/schema/taxonomy.js'
import { bundleItems, collectionProducts, productAttributeValues, productCategories, productMedia, productOptionValues, productOptions, productRelated, productSizes, products, variantOptionValues, variants } from '../../db/schema/products.js'
import { actorOf, duplicateKey, isReferenced, productChanged, purge } from './common.js'
import { allPass, publishChecks } from './product-checks.js'
import { bestStatus, loadProducts, noStock, variantStatus } from './product-loader.js'
import * as taxonomy from './repository.js'

/** @typedef {import('./common.js').Staff} Staff */
/** @typedef {import('./common.js').RequestInfo} RequestInfo */
/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {import('@noor/contract').ProductInput} ProductInput */
/** @typedef {import('./product-loader.js').Stock} Stock */

const issue = (/** @type {string} */ path, /** @type {import('@noor/contract').FieldIssueCode} */ code) => ({ path, code })
const PREVIEW_MINUTES = 15
const STATUS_ORDER = /** @type {const} */ ({ in: 'in_stock', low: 'low_stock', sold_out: 'sold_out', mto: 'made_to_order' })

/**
 * The derived columns of a product, from its enabled variants (DOC-09.3 section 7). The only writer of those columns.
 * @param {Db} tx @param {string} productId @param {Stock} stock
 */
export async function recomputeProductCache(tx, productId, stock = noStock) {
  const enabled = (await tx.select().from(variants).where(eq(variants.productId, productId))).filter((v) => v.enabled)
  const available = await stock.available(tx, enabled.map((v) => v.id))
  const low = await stock.lowStockThreshold(tx)
  const cheapest = [...enabled].sort((a, b) => a.priceMinor - b.priceMinor)[0]
  await tx
    .update(products)
    .set({
      priceMinMinor: cheapest ? cheapest.priceMinor : 0,
      priceMaxMinor: enabled.length ? Math.max(...enabled.map((v) => v.priceMinor)) : 0,
      compareAtMinMinor: cheapest?.compareAtMinor ?? null,
      stockStatus: bestStatus(enabled.map((v) => variantStatus(v.stockMode, available.get(v.id) ?? 0, low))),
    })
    .where(eq(products.id, productId))

  // the size index: a size is "in stock" when one of its variants can be bought
  const sizeOf = enabled.length
    ? await tx
        .select({ variantId: variantOptionValues.variantId, sizeId: productOptionValues.sizeSystemValueId })
        .from(variantOptionValues)
        .innerJoin(productOptionValues, eq(productOptionValues.id, variantOptionValues.optionValueId))
        .where(inArray(variantOptionValues.variantId, enabled.map((v) => v.id)))
    : []
  /** @type {Map<string, boolean>} */
  const sizes = new Map()
  for (const { variantId, sizeId } of sizeOf) {
    if (!sizeId) continue
    const v = enabled.find((e) => e.id === variantId)
    sizes.set(sizeId, !!sizes.get(sizeId) || v?.stockMode !== 'counted' || (available.get(variantId) ?? 0) > 0)
  }
  await tx.delete(productSizes).where(eq(productSizes.productId, productId))
  if (sizes.size) await tx.insert(productSizes).values([...sizes].map(([sizeSystemValueId, inStock]) => ({ productId, sizeSystemValueId, inStock })))
}

/**
 * The rating of a product, from its approved reviews only (DOC-09.3 section 7): the average times 100, and how many. Called after a review is approved or rejected.
 * @param {Db} tx @param {string} productId
 */
export async function recomputeRating(tx, productId) {
  const [r] = await tx.select({ n: count(), avg: sql`avg(${reviews.rating})`.mapWith(Number) }).from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')))
  const n = r?.n ?? 0
  await tx.update(products).set({ ratingCount: n, ratingAvgX100: n ? Math.round((r?.avg ?? 0) * 100) : null }).where(eq(products.id, productId))
}

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {Stock} deps.stock
 * @param {(categoryId: string) => Promise<{ attributeId: string, required: boolean }[]>} deps.filtersOf the filters a category shows, inherited ones included
 */
export function createProducts({ db, config, media, stock, filtersOf }) {
  const loadDeps = { media, stock }
  const previewKey = createHmac('sha256', config.DATA_ENCRYPTION_KEY).update('product-preview').digest()

  // ================================ reading ================================
  /** @param {Db} x @param {string[]} ids */
  const load = (x, ids) => loadProducts(x, ids, loadDeps)

  /** What the checks need to know that is not in the document. @param {Db} x @param {{ primaryCategoryId: string, bundleProductIds?: string[] }} doc */
  async function checkEnv(x, doc) {
    const children = doc.bundleProductIds?.length ? await x.select({ id: products.id, status: products.status }).from(products).where(inArray(products.id, doc.bundleProductIds)) : []
    return {
      bundleChildStatus: new Map(children.map((c) => [c.id, c.status])),
      requiredAttributeIds: new Set((await filtersOf(doc.primaryCategoryId)).filter((f) => f.required).map((f) => f.attributeId)),
    }
  }

  /** @param {Db} x @param {ProductInput} doc */
  const checksOf = async (x, doc) => publishChecks(doc, await checkEnv(x, doc))

  /** @param {Awaited<ReturnType<typeof load>>[number]} doc */
  const toRow = (doc, hasIssues = false) => {
    const prices = doc.variants.filter((v) => v.enabled).map((v) => v.price.amount)
    const lo = prices.length ? Math.min(...prices) : 0
    const hi = prices.length ? Math.max(...prices) : 0
    const first = doc.media[0]?.image
    return {
      id: doc.id,
      handle: doc.handle,
      title: doc.title,
      ...(doc.colorway ? { colorwayLabel: doc.colorway.label } : {}),
      ...(first ? { image: first } : {}),
      status: doc.status,
      kind: doc.kind,
      primaryCategory: { id: doc.primaryCategoryId, name: doc.primaryCategoryName },
      variantCount: doc.variants.length,
      stockStatus: bestStatus(doc.variants.filter((v) => v.enabled).map((v) => v.stockStatus)),
      priceFrom: { amount: lo, currency: /** @type {const} */ ('PKR') },
      ...(hi > lo ? { priceTo: { amount: hi, currency: /** @type {const} */ ('PKR') } } : {}),
      updatedAt: doc.updatedAt,
      hasIssues,
    }
  }

  /** Rows for a list: the document of each product plus whether its publish checks fail. @param {Db} x @param {string[]} ids */
  async function rowsOf(x, ids) {
    const docs = await load(x, ids)
    const order = new Map(ids.map((id, i) => [id, i]))
    docs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const rows = []
    for (const d of docs) rows.push(toRow(d, !allPass(await checksOf(x, /** @type {ProductInput} */ (/** @type {unknown} */ (d))))))
    return rows
  }

  /** @param {Db} x @param {string} id */
  async function view(x, id) {
    const doc = (await load(x, [id]))[0]
    if (!doc) throw new DomainError('not_found')
    const { primaryCategoryName: _name, ...rest } = doc
    void _name
    return { ...rest, checks: await checksOf(x, /** @type {ProductInput} */ (/** @type {unknown} */ (doc))) }
  }

  /** What the audit trail compares: the document without ids that carry no meaning to a reader. @param {Awaited<ReturnType<typeof load>>[number] | undefined} d */
  const auditView = (d) =>
    d
      ? {
          handle: d.handle, status: d.status, publishAt: d.publishAt, kind: d.kind, title: d.title, subtitle: d.subtitle, brand: d.brand, descriptionMd: d.descriptionMd,
          highlights: d.highlights, care: d.care, components: d.components, primaryCategoryId: d.primaryCategoryId, categoryIds: d.categoryIds, attributes: d.attributes,
          styleId: d.styleId, colorway: d.colorway, media: d.media.map((m) => `${m.mediaId}|${m.alt}|${m.role ?? ''}|${m.optionValueKey ?? ''}`),
          options: Object.fromEntries(d.options.map((o) => [o.name, { role: o.role, display: o.display, values: o.values.map((v) => v.label) }])),
          variants: Object.fromEntries(d.variants.map((v) => [v.sku, { price: v.price.amount, compareAt: v.compareAt?.amount ?? null, stockMode: v.stockMode, maxPerOrder: v.maxPerOrder, enabled: v.enabled, options: v.optionValueKeys.length }])),
          sizeChartId: d.sizeChartId, customSizeSchemaId: d.customSizeSchemaId, fit: d.fit, madeToOrder: d.madeToOrder, bundleProductIds: d.bundleProductIds, relatedIds: d.relatedIds,
          badges: d.badges, featuredRank: d.featuredRank, seo: d.seo, i18n: d.i18n,
        }
      : {}

  // ================================ validation ================================
  /** Structure that needs no database: options, values, variants. @param {ProductInput} input */
  function structureIssues(input) {
    /** @type {{ path: string, code: import('@noor/contract').FieldIssueCode }[]} */
    const issues = []
    const valueKeys = new Map() // key -> option index
    input.options.forEach((o, oi) => {
      if (o.role === 'size' ? false : o.sizeSystemId) issues.push(issue(`options.${oi}.sizeSystemId`, 'invalid_format'))
      const labels = new Set()
      o.values.forEach((v, vi) => {
        if (valueKeys.has(v.key)) issues.push(issue(`options.${oi}.values.${vi}.key`, 'not_unique'))
        valueKeys.set(v.key, oi)
        const label = v.label.toLowerCase()
        if (labels.has(label)) issues.push(issue(`options.${oi}.values.${vi}.label`, 'not_unique'))
        labels.add(label)
        if (v.kind === 'custom' && !(o.role === 'size' && input.customSizeSchemaId)) issues.push(issue(`options.${oi}.values.${vi}.kind`, 'invalid_format'))
        if (input.styleId && o.role === 'color') issues.push(issue(`options.${oi}.role`, 'invalid_format')) // colourways are separate products (ADR-0014)
      })
    })
    const skus = new Set()
    const combos = new Set()
    const keys = new Set()
    input.variants.forEach((v, i) => {
      if (keys.has(v.key)) issues.push(issue(`variants.${i}.key`, 'not_unique'))
      keys.add(v.key)
      const sku = v.sku.toUpperCase()
      if (skus.has(sku)) issues.push(issue(`variants.${i}.sku`, 'not_unique'))
      skus.add(sku)
      const picked = v.optionValueKeys.map((k) => valueKeys.get(k))
      const complete = picked.length === input.options.length && picked.every((o) => o !== undefined) && new Set(picked).size === picked.length
      if (!complete) issues.push(issue(`variants.${i}.optionValueKeys`, 'invalid_format'))
      else {
        const combo = [...v.optionValueKeys].sort().join('_')
        if (combos.has(combo)) issues.push(issue(`variants.${i}.optionValueKeys`, 'not_unique'))
        combos.add(combo)
      }
      if (v.compareAt && v.compareAt.amount <= v.price.amount) issues.push(issue(`variants.${i}.compareAt`, 'too_small'))
      if (v.stockMode === 'preorder' && !v.preorderShipsAt) issues.push(issue(`variants.${i}.preorderShipsAt`, 'required'))
      if (v.stockMode !== 'preorder' && v.preorderShipsAt) issues.push(issue(`variants.${i}.preorderShipsAt`, 'invalid_format'))
    })
    if (input.kind === 'bundle' && input.variants.length > 1) issues.push(issue('variants', 'too_big')) // a bundle is sold as one priced set
    if (input.styleId && !input.colorway) issues.push(issue('colorway', 'required'))
    if (input.status === 'scheduled' && !input.publishAt) issues.push(issue('publishAt', 'required'))
    if (input.madeToOrder && input.kind !== 'made_to_order') issues.push(issue('madeToOrder', 'invalid_format'))
    if (input.madeToOrder && input.madeToOrder.leadMinDays > input.madeToOrder.leadMaxDays) issues.push(issue('madeToOrder.leadMinDays', 'too_big'))
    if (input.bundleProductIds?.length && input.kind !== 'bundle') issues.push(issue('bundleProductIds', 'invalid_format'))
    if (input.badges && new Set(input.badges).size !== input.badges.length) issues.push(issue('badges', 'not_unique'))
    for (const [i, row] of (/** @type {{ initialStock?: { variantKey: string, quantity: number }[] }} */ (input).initialStock ?? []).entries()) {
      const v = input.variants.find((x) => x.key === row.variantKey)
      if (!v || v.stockMode !== 'counted') issues.push(issue(`initialStock.${i}.variantKey`, 'invalid_format'))
    }
    input.media.forEach((m, i) => {
      if (m.optionValueKey && !valueKeys.has(m.optionValueKey)) issues.push(issue(`media.${i}.optionValueKey`, 'invalid_format'))
    })
    const mediaIds = new Set()
    input.media.forEach((m, i) => {
      if (mediaIds.has(m.mediaId)) issues.push(issue(`media.${i}.mediaId`, 'not_unique'))
      mediaIds.add(m.mediaId)
    })
    return issues
  }

  /** Everything that needs the database. Throws one `validation_failed` listing every problem found. @param {Db} tx @param {ProductInput} input @param {string | null} selfId */
  async function validate(tx, input, selfId) {
    const issues = structureIssues(input)
    const exists = async (/** @type {import('drizzle-orm/mysql-core').AnyMySqlTable & { id: import('drizzle-orm/mysql-core').AnyMySqlColumn }} */ table, /** @type {string[]} */ ids) =>
      new Set(ids.length ? (await tx.select({ id: table.id }).from(table).where(inArray(table.id, ids))).map((r) => /** @type {{ id: string }} */ (r).id) : [])

    const categoryIds = [input.primaryCategoryId, ...input.categoryIds]
    const haveCategories = await exists(categories, categoryIds)
    categoryIds.forEach((id, i) => {
      if (!haveCategories.has(id)) issues.push(issue(i === 0 ? 'primaryCategoryId' : `categoryIds.${i - 1}`, 'invalid_format'))
    })
    if (input.sizeChartId && !(await exists(sizeCharts, [input.sizeChartId])).size) issues.push(issue('sizeChartId', 'invalid_format'))
    if (input.customSizeSchemaId && !(await exists(formSchemas, [input.customSizeSchemaId])).size) issues.push(issue('customSizeSchemaId', 'invalid_format'))

    // size options draw from a size system
    for (const [oi, o] of input.options.entries()) {
      if (o.sizeSystemId && !(await exists(sizeSystems, [o.sizeSystemId])).size) issues.push(issue(`options.${oi}.sizeSystemId`, 'invalid_format'))
      const wanted = o.values.flatMap((v) => (v.sizeSystemValueId ? [v.sizeSystemValueId] : []))
      if (wanted.length) {
        const found = new Map((await tx.select().from(sizeSystemValues).where(inArray(sizeSystemValues.id, wanted))).map((r) => [r.id, r.sizeSystemId]))
        o.values.forEach((v, vi) => {
          if (v.sizeSystemValueId && (found.get(v.sizeSystemValueId) === undefined || found.get(v.sizeSystemValueId) !== o.sizeSystemId)) issues.push(issue(`options.${oi}.values.${vi}.sizeSystemValueId`, 'invalid_format'))
        })
      }
    }

    // pictures must be ready
    const mediaIds = input.media.map((m) => m.mediaId)
    const ready = await readyIds(tx, mediaIds)
    const notReady = mediaIds.find((id) => !ready.has(id))
    if (notReady) throw new DomainError('media_not_ready', { mediaId: notReady })

    // attributes and their values
    const attrIds = input.attributes.map((a) => a.attributeId)
    const attrRows = new Map((attrIds.length ? await tx.select().from(attributes).where(inArray(attributes.id, attrIds)) : []).map((a) => [a.id, a]))
    const valueRows = attrIds.length ? await tx.select().from(attributeValues).where(inArray(attributeValues.attributeId, attrIds)) : []
    const seenAttr = new Set()
    input.attributes.forEach((a, i) => {
      const row = attrRows.get(a.attributeId)
      if (seenAttr.has(a.attributeId)) issues.push(issue(`attributes.${i}.attributeId`, 'not_unique'))
      seenAttr.add(a.attributeId)
      if (!row) return void issues.push(issue(`attributes.${i}.attributeId`, 'invalid_format'))
      const own = new Set(valueRows.filter((v) => v.attributeId === a.attributeId).map((v) => v.id))
      if (row.type === 'number') {
        if (a.number === undefined || a.valueIds?.length) issues.push(issue(`attributes.${i}.number`, 'required'))
      } else {
        if (a.number !== undefined) issues.push(issue(`attributes.${i}.number`, 'invalid_format'))
        const picked = a.valueIds ?? []
        if (!picked.length || (row.type === 'boolean' && picked.length !== 1) || picked.some((id) => !own.has(id)) || new Set(picked).size !== picked.length) issues.push(issue(`attributes.${i}.valueIds`, 'invalid_format'))
      }
    })

    // bundle children and related products
    const others = [...(input.bundleProductIds ?? []), ...(input.relatedIds ?? [])]
    const haveOthers = new Map((others.length ? await tx.select({ id: products.id, kind: products.kind }).from(products).where(inArray(products.id, others)) : []).map((p) => [p.id, p.kind]))
    ;(input.bundleProductIds ?? []).forEach((id, i) => {
      if (id === selfId || !haveOthers.has(id) || haveOthers.get(id) === 'bundle') issues.push(issue(`bundleProductIds.${i}`, 'invalid_format'))
    })
    ;(input.relatedIds ?? []).forEach((id, i) => {
      if (id === selfId || !haveOthers.has(id)) issues.push(issue(`relatedIds.${i}`, 'invalid_format'))
    })
    if (new Set(input.bundleProductIds ?? []).size !== (input.bundleProductIds ?? []).length) issues.push(issue('bundleProductIds', 'not_unique'))
    if (new Set(input.relatedIds ?? []).size !== (input.relatedIds ?? []).length) issues.push(issue('relatedIds', 'not_unique'))

    if (issues.length) throw new DomainError('validation_failed', { issues })
  }

  // ================================ writing ================================
  /** @param {ProductInput} input */
  const productColumns = (input) => {
    const mto = input.madeToOrder
    const ur = input.i18n?.ur
    return {
      handle: input.handle,
      status: input.status,
      publishAt: input.status === 'scheduled' && input.publishAt ? new Date(input.publishAt) : null,
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle || null,
      brand: input.brand || null,
      descriptionMd: input.descriptionMd || null,
      highlights: input.highlights?.length ? input.highlights : null,
      care: input.care?.length ? input.care : null,
      components: input.components?.length ? input.components : null,
      primaryCategoryId: input.primaryCategoryId,
      styleId: input.styleId ?? null,
      colorwayLabel: input.colorway?.label ?? null,
      colorFamily: input.colorway?.family ?? null,
      colorwaySwatch: input.colorway?.swatch ?? null,
      sizeChartId: input.sizeChartId ?? null,
      customSizeSchemaId: input.customSizeSchemaId ?? null,
      fit: input.fit && Object.keys(input.fit).length ? input.fit : null,
      mtoLeadMinDays: mto?.leadMinDays ?? null,
      mtoLeadMaxDays: mto?.leadMaxDays ?? null,
      mtoLeadLabel: mto?.label || null,
      mtoReturnable: mto ? mto.returnable : null,
      mtoDepositBps: mto?.depositPercent === undefined ? null : Math.round(mto.depositPercent * 100),
      badges: input.badges?.length ? input.badges : null,
      seoTitle: input.seo?.title || null,
      seoDescription: input.seo?.description || null,
      i18n: ur && Object.values(ur).some((v) => (Array.isArray(v) ? v.length : !!v)) ? { ur } : null,
      featuredRank: input.featuredRank ?? 0,
    }
  }

  /**
   * Writes options, option values, variants, pictures and the rest of a product that is already in `products`.
   * @param {Db} tx @param {string} id @param {ProductInput} input @param {Date} at
   */
  async function writeParts(tx, id, input, at) {
    // categories
    await tx.delete(productCategories).where(eq(productCategories.productId, id))
    await tx.insert(productCategories).values([...new Set([input.primaryCategoryId, ...input.categoryIds])].map((categoryId) => ({ productId: id, categoryId })))

    // options and values, matched by id
    const existingOptions = await tx.select().from(productOptions).where(eq(productOptions.productId, id))
    const optionOwn = new Set(existingOptions.map((o) => o.id))
    const existingValues = existingOptions.length ? await tx.select().from(productOptionValues).where(inArray(productOptionValues.optionId, existingOptions.map((o) => o.id))) : []
    const valueOwn = new Set(existingValues.map((v) => v.id))
    const bad = /** @type {{ path: string, code: import('@noor/contract').FieldIssueCode }[]} */ ([])
    input.options.forEach((o, oi) => {
      if (o.id && !optionOwn.has(o.id)) bad.push(issue(`options.${oi}.id`, 'invalid_format'))
      o.values.forEach((v, vi) => {
        if (v.id && !valueOwn.has(v.id)) bad.push(issue(`options.${oi}.values.${vi}.id`, 'invalid_format'))
      })
    })
    if (bad.length) throw new DomainError('validation_failed', { issues: bad })

    const keepOptions = new Set(input.options.flatMap((o) => (o.id ? [o.id] : [])))
    const keepValues = new Set(input.options.flatMap((o) => o.values.flatMap((v) => (v.id ? [v.id] : []))))
    const removedOptions = existingOptions.filter((o) => !keepOptions.has(o.id)).map((o) => o.id)
    if (removedOptions.length) await tx.delete(productOptions).where(inArray(productOptions.id, removedOptions)) // its values go with it
    const removedValues = existingValues.filter((v) => !keepValues.has(v.id) && !removedOptions.includes(v.optionId)).map((v) => v.id)
    if (removedValues.length) await tx.delete(productOptionValues).where(inArray(productOptionValues.id, removedValues))
    // labels may swap places, so park the survivors under names nobody has first
    const survivors = existingValues.filter((v) => keepValues.has(v.id)).map((v) => v.id)
    if (survivors.length) await tx.update(productOptionValues).set({ label: sql`concat('~', right(${productOptionValues.id}, 9))` }).where(inArray(productOptionValues.id, survivors))

    /** @type {Map<string, string>} */
    const valueIdByKey = new Map()
    /** @type {Map<string, string>} */
    const variantIdByKey = new Map()
    for (const [oi, o] of input.options.entries()) {
      const optionId = o.id ?? uuidv7()
      const cols = { name: o.name, role: o.role, display: o.display, sizeSystemId: o.sizeSystemId ?? null, sortOrder: oi, i18n: o.i18n?.ur?.name ? { ur: { name: o.i18n.ur.name } } : null }
      if (o.id) await tx.update(productOptions).set(cols).where(eq(productOptions.id, o.id))
      else await tx.insert(productOptions).values({ id: optionId, productId: id, ...cols })
      for (const [vi, v] of o.values.entries()) {
        const valueId = v.id ?? uuidv7()
        valueIdByKey.set(v.key, valueId)
        const vcols = { label: v.label, kind: v.kind ?? 'standard', sizeSystemValueId: v.sizeSystemValueId ?? null, swatch: v.swatch ?? null, sortOrder: vi, i18n: v.i18n?.ur?.label ? { ur: { label: v.i18n.ur.label } } : null }
        if (v.id) await tx.update(productOptionValues).set(vcols).where(eq(productOptionValues.id, v.id))
        else await tx.insert(productOptionValues).values({ id: valueId, optionId, ...vcols })
      }
    }

    // variants, matched by id; the ones that are gone are deleted unless something still points at them
    const existingVariants = await tx.select().from(variants).where(eq(variants.productId, id))
    const variantOwn = new Set(existingVariants.map((v) => v.id))
    input.variants.forEach((v, i) => {
      if (v.id && !variantOwn.has(v.id)) bad.push(issue(`variants.${i}.id`, 'invalid_format'))
    })
    if (bad.length) throw new DomainError('validation_failed', { issues: bad })
    const keepVariants = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])))
    const goneVariants = existingVariants.filter((v) => !keepVariants.has(v.id)).map((v) => v.id)
    if (goneVariants.length) await tx.delete(variants).where(inArray(variants.id, goneVariants))
    const staying = existingVariants.filter((v) => keepVariants.has(v.id)).map((v) => v.id)
    if (staying.length) await tx.update(variants).set({ sku: sql`concat('~', right(${variants.id}, 8))`, optionKey: sql`concat('~', ${variants.id})` }).where(inArray(variants.id, staying))
    for (const [i, v] of input.variants.entries()) {
      const variantId = v.id ?? uuidv7()
      variantIdByKey.set(v.key, variantId)
      const valueIds = v.optionValueKeys.map((k) => /** @type {string} */ (valueIdByKey.get(k)))
      const cols = {
        sku: v.sku.toUpperCase(),
        optionKey: [...valueIds].sort().join('_'),
        priceMinor: v.price.amount,
        compareAtMinor: v.compareAt?.amount ?? null,
        stockMode: v.stockMode,
        preorderShipsAt: v.preorderShipsAt ?? null,
        maxPerOrder: v.maxPerOrder,
        enabled: v.enabled,
        sortOrder: i,
        updatedAt: at,
      }
      if (v.id) await tx.update(variants).set(cols).where(eq(variants.id, v.id))
      else await tx.insert(variants).values({ id: variantId, productId: id, ...cols, createdAt: at })
      await tx.delete(variantOptionValues).where(eq(variantOptionValues.variantId, variantId))
      if (valueIds.length) await tx.insert(variantOptionValues).values(valueIds.map((optionValueId) => ({ variantId, optionValueId })))
    }

    // pictures
    await tx.delete(productMedia).where(eq(productMedia.productId, id))
    if (input.media.length) {
      await tx.insert(productMedia).values(
        input.media.map((m, i) => ({ productId: id, mediaId: m.mediaId, sortOrder: i, role: m.role ?? null, alt: m.alt.trim() || null, optionValueId: m.optionValueKey ? (valueIdByKey.get(m.optionValueKey) ?? null) : null })),
      )
    }

    // attribute values; a number attribute keeps its figure on its single placeholder value
    await tx.delete(productAttributeValues).where(eq(productAttributeValues.productId, id))
    if (input.attributes.length) {
      const own = await tx.select().from(attributeValues).where(inArray(attributeValues.attributeId, input.attributes.map((a) => a.attributeId)))
      /** @type {(typeof productAttributeValues.$inferInsert)[]} */
      const rows = []
      for (const a of input.attributes) {
        if (a.number !== undefined) rows.push({ productId: id, attributeId: a.attributeId, valueId: /** @type {string} */ (own.find((v) => v.attributeId === a.attributeId)?.id), valueNumber: a.number })
        else for (const valueId of a.valueIds ?? []) rows.push({ productId: id, attributeId: a.attributeId, valueId, valueNumber: null })
      }
      if (rows.length) await tx.insert(productAttributeValues).values(rows)
    }

    // bundle children and related products
    await tx.delete(bundleItems).where(eq(bundleItems.bundleProductId, id))
    if (input.bundleProductIds?.length) await tx.insert(bundleItems).values(input.bundleProductIds.map((childProductId, i) => ({ bundleProductId: id, childProductId, sortOrder: i })))
    await tx.delete(productRelated).where(eq(productRelated.productId, id))
    if (input.relatedIds?.length) await tx.insert(productRelated).values(input.relatedIds.map((relatedProductId, i) => ({ productId: id, relatedProductId, sortOrder: i })))
    return { variantIdByKey }
  }

  /**
   * Creates (`id` null) or replaces a product.
   * @param {Staff & { canPublish: boolean }} actor @param {string | null} id @param {ProductInput & { version?: number }} input @param {RequestInfo} req
   */
  async function save(actor, id, input, req) {
    const productId = id ?? uuidv7()
    try {
      await transaction(db, async (tx) => {
        const at = now()
        const existing = id ? (await tx.select().from(products).where(eq(products.id, id)).for('update'))[0] : undefined
        if (id && !existing) throw new DomainError('not_found')
        if (existing && existing.version !== input.version) throw new DomainError('stale_write', { currentVersion: existing.version })
        // going live, scheduling, archiving and editing something already in one of those states belong to publishers
        if ((input.status !== 'draft' || (existing && existing.status !== 'draft')) && !actor.canPublish) throw new DomainError('forbidden')
        await validate(tx, input, id)
        if (input.status === 'active' || input.status === 'scheduled') {
          const failed = (await checksOf(tx, input)).filter((c) => !c.ok)
          if (failed.length) throw new DomainError('publish_checks_failed', { checks: failed })
        }
        const before = existing ? (await load(tx, [productId]))[0] : undefined
        const cols = productColumns(input)
        const publishedAt = existing?.publishedAt ?? (input.status === 'active' ? at : null)
        if (existing) {
          if (input.handle !== existing.handle) {
            await taxonomy.dropRedirect(tx, 'product', input.handle)
            await taxonomy.upsertRedirect(tx, 'product', existing.handle, productId, at)
          }
          await tx.update(products).set({ ...cols, publishedAt, version: existing.version + 1, updatedAt: at }).where(eq(products.id, productId))
        } else {
          await taxonomy.dropRedirect(tx, 'product', input.handle)
          await tx.insert(products).values({ id: productId, ...cols, publishedAt, version: 1, createdAt: at, updatedAt: at })
        }
        const { variantIdByKey } = await writeParts(tx, productId, input, at)
        await stock.ensureLevels?.(tx, [...variantIdByKey.values()])
        const initial = (/** @type {{ initialStock?: { variantKey: string, quantity: number }[] }} */ (input).initialStock ?? []).map((r) => ({ variantId: /** @type {string} */ (variantIdByKey.get(r.variantKey)), quantity: r.quantity }))
        if (!existing && initial.length) await stock.initial?.(tx, initial, actor.staffId)
        await recomputeProductCache(tx, productId, stock)
        const after = (await load(tx, [productId]))[0]
        await record(tx, { ...actorOf(actor, req), action: existing ? 'product.updated' : 'product.created', entityType: 'product', entityId: productId, entityLabel: input.handle, diff: diffOf(auditView(before), auditView(after)) })
        await purge(tx, ['products', `product:${input.handle}`, ...(existing && existing.handle !== input.handle ? [`product:${existing.handle}`] : [])], req.requestId)
        await productChanged(tx, productId)
      })
    } catch (e) {
      const key = duplicateKey(e)
      if (key === 'products_handle_uq') throw new DomainError('handle_taken')
      if (key === 'variants_sku_uq') throw new DomainError('sku_taken')
      if (isReferenced(e)) throw new DomainError('in_use') // an order line still points at a variant that was removed
      throw e
    }
    return view(db, productId)
  }

  // ================================ the public face of the service ================================
  /** @param {string} id @param {number | string} exp */
  const sign = (id, exp) => createHmac('sha256', previewKey).update(`${id}.${exp}`).digest('base64url')

  /** @param {string} handle */
  const freeHandle = async (handle) => {
    const taken = new Set((await db.select({ h: products.handle }).from(products).where(like(products.handle, `${handle}-copy%`))).map((r) => r.h))
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? `${handle}-copy` : `${handle}-copy-${n}`
      if (!taken.has(candidate)) return candidate
    }
  }

  return {
    recompute: (/** @type {Db} */ tx, /** @type {string} */ productId) => recomputeProductCache(tx, productId, stock),
    recomputeRating,
    /** After stock moved: the cached stock status of these products. */
    async recomputeMany(/** @type {Db} */ tx, /** @type {string[]} */ ids) {
      for (const id of ids) await recomputeProductCache(tx, id, stock)
    },
    load: (/** @type {Db} */ x, /** @type {string[]} */ ids) => load(x, ids),
    rowsOf,
    get: (/** @type {string} */ id) => view(db, id),
    save,

    /** @param {{ q?: string, status?: string, category?: string, collection?: string, kind?: string, stock?: 'in' | 'low' | 'sold_out' | 'mto', sort?: string, page: number, size: number }} f */
    async list(f) {
      const sorts = { title: products.title, status: products.status, price: products.priceMinMinor, updatedAt: products.updatedAt }
      const field = (f.sort ?? '-updatedAt').replace(/^-/, '')
      if (!(field in sorts)) throw new DomainError('validation_failed', { issues: [issue('sort', 'invalid_format')] })
      const column = sorts[/** @type {keyof typeof sorts} */ (field)]
      let categoryIds = f.category ? [f.category] : undefined
      if (f.category) {
        const all = await taxonomy.allCategories(db)
        const subtree = new Set([f.category])
        for (let grew = true; grew; ) {
          grew = false
          for (const c of all) {
            if (c.parentId && subtree.has(c.parentId) && !subtree.has(c.id)) {
              subtree.add(c.id)
              grew = true
            }
          }
        }
        categoryIds = [...subtree]
      }
      const where = and(
        f.status ? eq(products.status, f.status) : undefined,
        f.kind ? eq(products.kind, f.kind) : undefined,
        f.stock ? eq(products.stockStatus, STATUS_ORDER[f.stock]) : undefined,
        f.q ? or(like(products.title, `%${f.q}%`), like(products.handle, `%${f.q.toLowerCase()}%`), inArray(products.id, db.select({ id: variants.productId }).from(variants).where(like(variants.sku, `${f.q.toUpperCase()}%`)))) : undefined,
        categoryIds ? inArray(products.id, db.select({ id: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, categoryIds))) : undefined,
        f.collection ? inArray(products.id, db.select({ id: collectionProducts.productId }).from(collectionProducts).where(eq(collectionProducts.collectionId, f.collection))) : undefined,
      )
      const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(products).where(where)
      const ids = (
        await db
          .select({ id: products.id })
          .from(products)
          .where(where)
          .orderBy((f.sort ?? '-updatedAt').startsWith('-') ? desc(column) : asc(column), asc(products.id))
          .limit(f.size)
          .offset((f.page - 1) * f.size)
      ).map((r) => r.id)
      return { items: await rowsOf(db, ids), total, page: f.page, size: f.size }
    },

    /** @param {string} sku @param {string} [exceptVariantId] */
    async skuAvailable(sku, exceptVariantId) {
      const rows = await db.select({ id: variants.id }).from(variants).where(eq(variants.sku, sku.toUpperCase()))
      return { available: rows.every((r) => r.id === exceptVariantId) }
    },

    /** The same function the save uses, on a document that may not be saved yet. @param {ProductInput} input */
    async checks(input) {
      return { checks: await checksOf(db, input) }
    },

    /** @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async remove(actor, id, req) {
      try {
        await transaction(db, async (tx) => {
          const p = (await tx.select().from(products).where(eq(products.id, id)).for('update'))[0]
          if (!p) throw new DomainError('not_found')
          const before = (await load(tx, [id]))[0]
          await tx.delete(products).where(eq(products.id, id))
          await taxonomy.dropRedirectsOf(tx, 'product', id)
          await record(tx, { ...actorOf(actor, req), action: 'product.deleted', entityType: 'product', entityId: id, entityLabel: p.handle, diff: diffOf(auditView(before), {}) })
          await purge(tx, ['products', `product:${p.handle}`], req.requestId)
        })
      } catch (e) {
        if (isReferenced(e)) throw new DomainError('in_use') // order lines, or a bundle that contains it: archive instead
        throw e
      }
    },

    /** A draft copy: handle gets `-copy`, SKUs get `-COPY` (they must stay unique), nothing is in stock. @param {Staff & { canPublish: boolean }} actor @param {string} id @param {RequestInfo} req */
    async duplicate(actor, id, req) {
      const doc = (await load(db, [id]))[0]
      if (!doc) throw new DomainError('not_found')
      const taken = new Set((await db.select({ sku: variants.sku }).from(variants).where(like(variants.sku, '%-COPY%'))).map((r) => r.sku))
      const sku = (/** @type {string} */ s) => {
        for (let n = 1; ; n++) {
          const candidate = `${s}-COPY${n === 1 ? '' : n}`.slice(0, 40)
          if (!taken.has(candidate)) return (taken.add(candidate), candidate)
        }
      }
      /** @type {ProductInput} */
      const input = {
        handle: await freeHandle(doc.handle),
        status: 'draft',
        kind: doc.kind,
        title: doc.title,
        ...(doc.subtitle ? { subtitle: doc.subtitle } : {}),
        ...(doc.brand ? { brand: doc.brand } : {}),
        ...(doc.descriptionMd ? { descriptionMd: doc.descriptionMd } : {}),
        ...(doc.highlights ? { highlights: doc.highlights } : {}),
        ...(doc.care ? { care: doc.care } : {}),
        ...(doc.components ? { components: doc.components } : {}),
        primaryCategoryId: doc.primaryCategoryId,
        categoryIds: doc.categoryIds,
        attributes: doc.attributes,
        ...(doc.styleId ? { styleId: doc.styleId } : {}),
        ...(doc.colorway ? { colorway: doc.colorway } : {}),
        media: doc.media.map(({ image: _image, ...m }) => (void _image, m)),
        options: doc.options.map((o) => ({ name: o.name, role: o.role, display: o.display, ...(o.sizeSystemId ? { sizeSystemId: o.sizeSystemId } : {}), ...(o.i18n ? { i18n: o.i18n } : {}), values: o.values.map(({ id: _id, ...v }) => (void _id, v)) })),
        variants: doc.variants.map((v) => ({ key: v.key, sku: sku(v.sku), optionValueKeys: v.optionValueKeys, price: v.price, ...(v.compareAt ? { compareAt: v.compareAt } : {}), stockMode: v.stockMode, ...(v.preorderShipsAt ? { preorderShipsAt: v.preorderShipsAt } : {}), maxPerOrder: v.maxPerOrder, enabled: v.enabled })),
        ...(doc.sizeChartId ? { sizeChartId: doc.sizeChartId } : {}),
        ...(doc.customSizeSchemaId ? { customSizeSchemaId: doc.customSizeSchemaId } : {}),
        ...(doc.fit ? { fit: doc.fit } : {}),
        ...(doc.madeToOrder ? { madeToOrder: doc.madeToOrder } : {}),
        ...(doc.bundleProductIds ? { bundleProductIds: doc.bundleProductIds } : {}),
        ...(doc.relatedIds ? { relatedIds: doc.relatedIds } : {}),
        ...(doc.badges ? { badges: doc.badges } : {}),
        ...(doc.seo ? { seo: doc.seo } : {}),
        ...(doc.i18n ? { i18n: doc.i18n } : {}),
      }
      return save({ ...actor, canPublish: false }, null, input, req)
    },

    /** A link that shows a product that is not live, for 15 minutes. @param {string} id */
    async previewLink(id) {
      const p = (await db.select({ handle: products.handle }).from(products).where(eq(products.id, id)))[0]
      if (!p) throw new DomainError('not_found')
      const exp = now().getTime() + PREVIEW_MINUTES * 60_000
      return { url: `${config.STOREFRONT_URL.replace(/\/$/, '')}/p/${p.handle}?preview=${id}.${exp}.${sign(id, exp)}`, expiresAt: new Date(exp).toISOString() }
    },

    /** The product id a preview token opens, or null. For the public catalog routes. @param {string} token */
    verifyPreview(token) {
      const [id, exp, mac] = token.split('.')
      if (!id || !exp || !mac || !(Number(exp) > now().getTime())) return null
      const want = Buffer.from(sign(id, exp))
      const got = Buffer.from(mac)
      return want.length === got.length && timingSafeEqual(want, got) ? id : null
    },

    /** Job `catalog.publish_scheduled` (every minute): scheduled products whose time has come go live, if their checks still pass. */
    async publishDue() {
      const at = now()
      const due = await db.select({ id: products.id, handle: products.handle }).from(products).where(and(eq(products.status, 'scheduled'), lte(products.publishAt, at))).limit(100)
      let published = 0
      for (const p of due) {
        await transaction(db, async (tx) => {
          const locked = (await tx.select().from(products).where(eq(products.id, p.id)).for('update'))[0]
          if (!locked || locked.status !== 'scheduled') return
          const doc = (await load(tx, [p.id]))[0]
          if (!doc || !allPass(await checksOf(tx, /** @type {ProductInput} */ (/** @type {unknown} */ (doc))))) return // stays scheduled; the list flags it
          await tx.update(products).set({ status: 'active', publishedAt: locked.publishedAt ?? at, publishAt: null, version: locked.version + 1, updatedAt: at }).where(eq(products.id, p.id))
          await record(tx, { actor: { type: 'system', label: 'scheduled publish' }, action: 'product.published', entityType: 'product', entityId: p.id, entityLabel: p.handle, diff: { status: ['scheduled', 'active'] } })
          await purge(tx, ['products', `product:${p.handle}`], '')
          await productChanged(tx, p.id)
          published += 1
        })
      }
      return published
    },
  }
}

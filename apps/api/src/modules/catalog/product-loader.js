// Reads products back as the admin document (plan/10-api/05 `AdminProduct`), many at a time with a fixed number of queries.
import { asc, eq, inArray } from 'drizzle-orm'
import { media as mediaTable } from '../../db/schema/media.js'
import { attributes, categories } from '../../db/schema/taxonomy.js'
import { bundleItems, collectionProducts, collections, productAttributeValues, productCategories, productMedia, productOptionValues, productOptions, productRelated, products, variantOptionValues, variants } from '../../db/schema/products.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof products.$inferSelect} ProductRow */

/**
 * What stock says about the shop's variants. Inventory arrives with M1-10; until then nothing counted is available.
 * @typedef {object} Stock
 * @property {(db: Db, variantIds: string[]) => Promise<Map<string, number>>} available units that can be sold now, by variant
 * @property {() => Promise<number>} lowStockThreshold at or below this many, a variant is "low stock"
 * @property {(db: Db, variantIds: string[]) => Promise<Map<string, { onHand: number, reserved: number }>>} [levels] counted variants' on hand and reserved
 * @property {(tx: Db, variantIds: string[]) => Promise<void>} [ensureLevels] gives every counted variant among them a level row
 * @property {(tx: Db, rows: { variantId: string, quantity: number }[], staffId: string) => Promise<void>} [initial] the first quantities of a new product
 */
/** @type {Stock} */
export const noStock = {
  available: async (_db, ids) => new Map(ids.map((id) => [id, 0])),
  lowStockThreshold: async () => 3,
}

const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })
const iso = (/** @type {Date | null} */ d) => (d ? d.toISOString() : undefined)

/**
 * Status of one variant (plan/09-data-model/03-catalog.md section 7).
 * @param {string} stockMode @param {number} available @param {number} low
 * @returns {import('@noor/contract').EnumValue<'stockStatus'>}
 */
export function variantStatus(stockMode, available, low) {
  if (stockMode === 'made_to_order') return 'made_to_order'
  if (stockMode === 'preorder') return 'preorder'
  return available <= 0 ? 'sold_out' : available <= low ? 'low_stock' : 'in_stock'
}

const ORDER = /** @type {const} */ (['in_stock', 'low_stock', 'made_to_order', 'preorder', 'sold_out'])
/** The best status among variants: in_stock > low_stock > made_to_order > preorder > sold_out. @param {string[]} statuses */
export const bestStatus = (statuses) => /** @type {import('@noor/contract').EnumValue<'stockStatus'>} */ (ORDER.find((s) => statuses.includes(s)) ?? 'sold_out')

/**
 * @param {Db} db
 * @param {string[]} ids
 * @param {{ media: { imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }, stock: Stock }} deps
 * @returns {Promise<(Omit<import('@noor/contract').z.infer<typeof import('@noor/contract').AdminProduct>, 'checks'> & { primaryCategoryName: string })[]>}
 */
export async function loadProducts(db, ids, { media, stock }) {
  if (!ids.length) return []
  const rows = await db.select().from(products).where(inArray(products.id, ids))
  const [cats, categoryNames, opts, vars, links, attrValues, attrs, bundles, related, collectionRows] = await Promise.all([
    db.select().from(productCategories).where(inArray(productCategories.productId, ids)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, rows.map((r) => r.primaryCategoryId))),
    db.select().from(productOptions).where(inArray(productOptions.productId, ids)).orderBy(asc(productOptions.sortOrder)),
    db.select().from(variants).where(inArray(variants.productId, ids)).orderBy(asc(variants.sortOrder), asc(variants.id)),
    db.select().from(productMedia).where(inArray(productMedia.productId, ids)).orderBy(asc(productMedia.sortOrder)),
    db.select().from(productAttributeValues).where(inArray(productAttributeValues.productId, ids)),
    db.select().from(attributes),
    db.select().from(bundleItems).where(inArray(bundleItems.bundleProductId, ids)).orderBy(asc(bundleItems.sortOrder)),
    db.select().from(productRelated).where(inArray(productRelated.productId, ids)).orderBy(asc(productRelated.sortOrder)),
    db
      .select({ productId: collectionProducts.productId, id: collections.id, title: collections.title })
      .from(collectionProducts)
      .innerJoin(collections, eq(collections.id, collectionProducts.collectionId))
      .where(inArray(collectionProducts.productId, ids)),
  ])
  const optionIds = opts.map((o) => o.id)
  const values = optionIds.length ? await db.select().from(productOptionValues).where(inArray(productOptionValues.optionId, optionIds)).orderBy(asc(productOptionValues.sortOrder)) : []
  const variantIds = vars.map((v) => v.id)
  const variantValues = variantIds.length ? await db.select().from(variantOptionValues).where(inArray(variantOptionValues.variantId, variantIds)) : []
  const styleIds = [...new Set(rows.flatMap((r) => (r.styleId ? [r.styleId] : [])))]
  const siblingRows = styleIds.length ? await db.select().from(products).where(inArray(products.styleId, styleIds)) : []
  const images = await media.imagesFor(links.map((l) => l.mediaId))
  const mediaAlt = links.length ? await db.select({ id: mediaTable.id, alt: mediaTable.alt }).from(mediaTable).where(inArray(mediaTable.id, links.map((l) => l.mediaId))) : []
  const available = await stock.available(db, variantIds)
  const levels = (await stock.levels?.(db, variantIds)) ?? null
  const low = await stock.lowStockThreshold()
  const attrById = new Map(attrs.map((a) => [a.id, a]))

  return rows.map((p) => {
    const mine = {
      options: opts.filter((o) => o.productId === p.id),
      variants: vars.filter((v) => v.productId === p.id),
      links: links.filter((l) => l.productId === p.id),
    }
    const optionOrder = new Map(mine.options.map((o, i) => [o.id, i]))
    const valuesOf = (/** @type {string} */ optionId) => values.filter((v) => v.optionId === optionId)
    const valueOption = new Map(values.map((v) => [v.id, v.optionId]))
    const variantViews = mine.variants.map((v) => {
      const picked = variantValues.filter((vv) => vv.variantId === v.id).map((vv) => vv.optionValueId)
      picked.sort((a, b) => (optionOrder.get(valueOption.get(a) ?? '') ?? 0) - (optionOrder.get(valueOption.get(b) ?? '') ?? 0))
      return {
        id: v.id,
        key: v.id,
        sku: v.sku,
        optionValueKeys: picked,
        price: money(v.priceMinor),
        ...(v.compareAtMinor === null ? {} : { compareAt: money(v.compareAtMinor) }),
        stockMode: /** @type {import('@noor/contract').EnumValue<'stockMode'>} */ (v.stockMode),
        ...(v.preorderShipsAt ? { preorderShipsAt: v.preorderShipsAt } : {}),
        maxPerOrder: v.maxPerOrder,
        enabled: v.enabled,
        stockStatus: variantStatus(v.stockMode, available.get(v.id) ?? 0, low),
        ...(levels && v.stockMode === 'counted' ? { onHand: levels.get(v.id)?.onHand ?? 0, reserved: levels.get(v.id)?.reserved ?? 0 } : {}),
        hasOrders: false, // ponytail: order lines arrive with orders (M4); the foreign key already refuses deleting a variant they use
      }
    })
    const attrGroups = new Map()
    for (const r of attrValues.filter((x) => x.productId === p.id)) {
      const a = attrById.get(r.attributeId)
      const g = attrGroups.get(r.attributeId) ?? { attributeId: r.attributeId, ...(a?.type === 'number' ? {} : { valueIds: [] }) }
      if (a?.type === 'number') g.number = r.valueNumber ?? 0
      else g.valueIds.push(r.valueId)
      attrGroups.set(r.attributeId, g)
    }
    const mto = p.mtoLeadMinDays !== null && p.mtoLeadMaxDays !== null
    const ur = /** @type {{ ur?: object } | null} */ (p.i18n)?.ur
    return {
      id: p.id,
      handle: p.handle,
      status: /** @type {import('@noor/contract').EnumValue<'productStatus'>} */ (p.status),
      ...(p.publishAt ? { publishAt: iso(p.publishAt) } : {}),
      kind: /** @type {import('@noor/contract').EnumValue<'productKind'>} */ (p.kind),
      title: p.title,
      ...(p.subtitle ? { subtitle: p.subtitle } : {}),
      ...(p.brand ? { brand: p.brand } : {}),
      ...(p.descriptionMd ? { descriptionMd: p.descriptionMd } : {}),
      ...(p.highlights ? { highlights: /** @type {string[]} */ (p.highlights) } : {}),
      ...(p.care ? { care: /** @type {string[]} */ (p.care) } : {}),
      ...(p.components ? { components: /** @type {import('@noor/contract').z.infer<typeof import('@noor/contract').Component>[]} */ (p.components) } : {}),
      primaryCategoryId: p.primaryCategoryId,
      primaryCategoryName: categoryNames.find((c) => c.id === p.primaryCategoryId)?.name ?? '',
      categoryIds: cats.filter((c) => c.productId === p.id && c.categoryId !== p.primaryCategoryId).map((c) => c.categoryId),
      attributes: [...attrGroups.values()],
      ...(p.styleId ? { styleId: p.styleId } : {}),
      ...(p.colorwayLabel && p.colorFamily ? { colorway: { label: p.colorwayLabel, family: /** @type {import('@noor/contract').EnumValue<'colorFamily'>} */ (p.colorFamily), swatch: /** @type {import('@noor/contract').Swatch} */ (p.colorwaySwatch) } } : {}),
      media: mine.links.map((l) => ({
        mediaId: l.mediaId,
        alt: l.alt ?? mediaAlt.find((m) => m.id === l.mediaId)?.alt ?? '',
        ...(l.role ? { role: /** @type {import('@noor/contract').EnumValue<'mediaRole'>} */ (l.role) } : {}),
        ...(l.optionValueId ? { optionValueKey: l.optionValueId } : {}),
        ...(images[l.mediaId] ? { image: images[l.mediaId] } : {}),
      })),
      options: mine.options.map((o) => ({
        id: o.id,
        name: o.name,
        role: /** @type {import('@noor/contract').EnumValue<'optionRole'>} */ (o.role),
        display: /** @type {import('@noor/contract').EnumValue<'optionDisplay'>} */ (o.display),
        ...(o.sizeSystemId ? { sizeSystemId: o.sizeSystemId } : {}),
        values: valuesOf(o.id).map((v) => ({
          id: v.id,
          key: v.id,
          label: v.label,
          kind: /** @type {import('@noor/contract').EnumValue<'optionValueKind'>} */ (v.kind),
          ...(v.sizeSystemValueId ? { sizeSystemValueId: v.sizeSystemValueId } : {}),
          ...(v.swatch ? { swatch: /** @type {import('@noor/contract').Swatch} */ (v.swatch) } : {}),
          ...(/** @type {{ ur?: { label?: string } } | null} */ (v.i18n)?.ur?.label ? { i18n: { ur: { label: /** @type {{ ur: { label: string } }} */ (v.i18n).ur.label } } } : {}),
        })),
        ...(/** @type {{ ur?: { name?: string } } | null} */ (o.i18n)?.ur?.name ? { i18n: { ur: { name: /** @type {{ ur: { name: string } }} */ (o.i18n).ur.name } } } : {}),
      })),
      variants: variantViews,
      ...(p.sizeChartId ? { sizeChartId: p.sizeChartId } : {}),
      ...(p.customSizeSchemaId ? { customSizeSchemaId: p.customSizeSchemaId } : {}),
      ...(p.fit ? { fit: /** @type {import('@noor/contract').ProductInput['fit']} */ (p.fit) } : {}),
      ...(mto
        ? {
            madeToOrder: {
              leadMinDays: /** @type {number} */ (p.mtoLeadMinDays),
              leadMaxDays: /** @type {number} */ (p.mtoLeadMaxDays),
              ...(p.mtoLeadLabel ? { label: p.mtoLeadLabel } : {}),
              returnable: p.mtoReturnable ?? false,
              ...(p.mtoDepositBps === null ? {} : { depositPercent: p.mtoDepositBps / 100 }),
            },
          }
        : {}),
      ...(p.kind === 'bundle' ? { bundleProductIds: bundles.filter((b) => b.bundleProductId === p.id).map((b) => b.childProductId) } : {}),
      ...(related.some((r) => r.productId === p.id) ? { relatedIds: related.filter((r) => r.productId === p.id).map((r) => r.relatedProductId) } : {}),
      ...(p.badges ? { badges: /** @type {import('@noor/contract').ProductInput['badges']} */ (p.badges) } : {}),
      ...(p.featuredRank ? { featuredRank: p.featuredRank } : {}),
      ...(p.seoTitle || p.seoDescription ? { seo: { ...(p.seoTitle ? { title: p.seoTitle } : {}), ...(p.seoDescription ? { description: p.seoDescription } : {}) } } : {}),
      ...(ur ? { i18n: { ur: /** @type {NonNullable<NonNullable<import('@noor/contract').ProductInput['i18n']>['ur']>} */ (ur) } } : {}),
      version: p.version,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      ...(p.publishedAt ? { publishedAt: iso(p.publishedAt) } : {}),
      siblings: p.styleId
        ? siblingRows.filter((s) => s.styleId === p.styleId && s.id !== p.id).map((s) => ({ id: s.id, handle: s.handle, title: s.title, colorwayLabel: s.colorwayLabel ?? '', status: /** @type {import('@noor/contract').EnumValue<'productStatus'>} */ (s.status) }))
        : [],
      collections: collectionRows.filter((c) => c.productId === p.id).map((c) => ({ id: c.id, title: c.title })),
      ...(p.status === 'active' ? { storefrontUrl: `/p/${p.handle}` } : {}),
    }
  })
}


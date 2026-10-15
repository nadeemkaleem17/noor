// What the storefront reads of the catalog (plan/10-api/02-catalog-public.md): product detail, related products, the category tree,
// collections, size charts, custom-size forms, back-in-stock requests and the sitemap. Only active products, visible categories and live
// collections are ever returned; the listing itself is in public-listing.js.
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { DomainError } from '../../platform/errors.js'
import { now } from '../../platform/clock.js'
import { subjectHash } from '../../platform/rate-limit.js'
import { pages } from '../../db/schema/content.js'
import { attributeValues, attributes, categories, categoryAttributes, formSchemas, handleRedirects, sizeCharts } from '../../db/schema/taxonomy.js'
import { collections, productRelated, products, variants } from '../../db/schema/products.js'
import { loadProducts } from './product-loader.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {'en' | 'ur'} Locale */
/** @typedef {Awaited<ReturnType<typeof loadProducts>>[number]} Doc */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {import('./product-loader.js').Stock} deps.stock
 * @param {ReturnType<typeof import('./public-listing.js').createListing>} deps.listing
 * @param {(token: string) => string | null} deps.verifyPreview the product id a preview token opens
 * @param {() => Promise<{ freeAboveFrom?: import('@noor/contract').Money, defaultEta?: { minDays: number, maxDays: number }, codAvailable?: boolean }>} deps.deliveryFacts
 * @param {() => Promise<boolean>} deps.notifyEnabled is the back-in-stock feature on
 * @param {(input: { variantId: string, phone: string, locale?: Locale }) => Promise<void>} deps.subscribe
 */
export function createPublicCatalog({ db, media, stock, listing, verifyPreview, deliveryFacts, notifyEnabled, subscribe }) {
  // ================================ categories ================================
  const loadCategories = () => db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))

  /** Visible categories only: one hidden on the way up hides everything below. @param {Awaited<ReturnType<typeof loadCategories>>} all */
  function visibleOf(all) {
    const byId = new Map(all.map((c) => [c.id, c]))
    return all.filter((c) => {
      for (let x = /** @type {typeof c | undefined} */ (c); x; x = x.parentId ? byId.get(x.parentId) : undefined) if (!x.visible) return false
      return true
    })
  }

  /** @param {{ i18n: unknown }} row @param {Locale} locale @param {string} key */
  const ur = (row, locale, key) => (locale === 'ur' ? /** @type {{ ur?: Record<string, string> } | null} */ (row.i18n)?.ur?.[key] : undefined) || undefined

  /** The path from the top category down to `id`, as `{ handle, name }`. @param {Awaited<ReturnType<typeof loadCategories>>} all @param {string} id @param {Locale} locale */
  function pathTo(all, id, locale) {
    const byId = new Map(all.map((c) => [c.id, c]))
    /** @type {{ handle: string, name: string }[]} */
    const out = []
    for (let c = byId.get(id); c; c = c.parentId ? byId.get(c.parentId) : undefined) out.unshift({ handle: c.handle, name: ur(c, locale, 'name') ?? c.name })
    return out
  }

  /** @param {string} handle @param {string} type */
  async function redirectFor(handle, type) {
    const r = (await db.select().from(handleRedirects).where(and(eq(handleRedirects.entityType, type), eq(handleRedirects.oldHandle, handle))))[0]
    return r ?? null
  }

  // ================================ product detail ================================
  /** @param {Doc} doc @param {Locale} locale */
  const optionsOf = (doc, locale) =>
    doc.options.map((o) => ({
      id: o.id,
      name: (locale === 'ur' && o.i18n?.ur?.name) || o.name,
      role: o.role,
      display: o.display,
      values: o.values.map((v) => ({ id: v.id, label: (locale === 'ur' && v.i18n?.ur?.label) || v.label, kind: v.kind ?? 'standard', ...(v.swatch ? { swatch: v.swatch } : {}) })),
    }))

  /** Enabled variants only; `available` never above `maxPerOrder`. @param {Doc} doc */
  const variantsOf = (doc) =>
    doc.variants
      .filter((v) => v.enabled)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        optionValueIds: v.optionValueKeys,
        price: v.price,
        ...(v.compareAt ? { compareAt: v.compareAt } : {}),
        stockStatus: v.stockStatus,
        ...(v.stockMode === 'counted' ? { available: Math.max(0, Math.min((v.onHand ?? 0) - (v.reserved ?? 0), v.maxPerOrder)) } : {}),
        maxPerOrder: v.maxPerOrder,
        ...(v.preorderShipsAt ? { preorderShipsAt: v.preorderShipsAt } : {}),
      }))

  /** @param {Doc} doc */
  async function attributesOf(doc) {
    if (!doc.attributes.length) return []
    const [defs, values] = await Promise.all([
      db.select().from(attributes).where(inArray(attributes.id, doc.attributes.map((a) => a.attributeId))),
      db.select().from(attributeValues).where(inArray(attributeValues.attributeId, doc.attributes.map((a) => a.attributeId))),
    ])
    return defs
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => {
        const mine = doc.attributes.find((a) => a.attributeId === d.id)
        const shown = mine?.number !== undefined ? [String(mine.number)] : (mine?.valueIds ?? []).map((id) => values.find((v) => v.id === id)?.label ?? '')
        return { ...(d.groupLabel ? { group: d.groupLabel } : {}), label: d.label, values: shown.filter(Boolean) }
      })
  }

  /** @param {Doc} doc @param {Locale} locale */
  async function detailOf(doc, locale, { includeBundle = true } = {}) {
    const all = await loadCategories()
    const [card] = await listing.summariesOf(db, [doc.id], locale)
    const sibRows = doc.styleId
      ? await db.select().from(products).where(and(eq(products.styleId, doc.styleId), eq(products.status, 'active'))).orderBy(asc(products.colorwayLabel))
      : []
    const sibCards = await listing.summariesOf(db, sibRows.map((s) => s.id), locale)
    const facts = await deliveryFacts()
    const dep = doc.madeToOrder?.depositPercent
    const ownUr = doc.i18n?.ur
    let bundle
    if (includeBundle && doc.kind === 'bundle' && doc.bundleProductIds?.length) {
      const children = await loadProducts(db, doc.bundleProductIds, { media, stock })
      const cards = await listing.summariesOf(db, doc.bundleProductIds, locale)
      bundle = { items: doc.bundleProductIds.flatMap((id) => { const c = children.find((x) => x.id === id); const product = cards.find((x) => x.id === id); return c && product ? [{ product, options: optionsOf(c, locale), variants: variantsOf(c) }] : [] }) }
    }
    return {
      id: doc.id,
      handle: doc.handle,
      kind: doc.kind,
      status: doc.status,
      title: (locale === 'ur' && ownUr?.title) || doc.title,
      ...((locale === 'ur' && ownUr?.subtitle) || doc.subtitle ? { subtitle: (locale === 'ur' && ownUr?.subtitle) || doc.subtitle } : {}),
      ...(doc.brand ? { brand: doc.brand } : {}),
      ...((locale === 'ur' && ownUr?.descriptionMd) || doc.descriptionMd ? { descriptionMd: (locale === 'ur' && ownUr?.descriptionMd) || doc.descriptionMd } : {}),
      highlights: (locale === 'ur' && ownUr?.highlights?.length ? ownUr.highlights : doc.highlights) ?? [],
      care: (locale === 'ur' && ownUr?.care?.length ? ownUr.care : doc.care) ?? [],
      breadcrumb: pathTo(all, doc.primaryCategoryId, locale),
      media: doc.media.flatMap((m) => (m.image ? [{ ...m.image, alt: m.alt || m.image.alt, id: m.mediaId, kind: /** @type {const} */ ('image'), ...(m.role ? { role: m.role } : {}), ...(m.optionValueKey ? { optionValueId: m.optionValueKey } : {}) }] : [])),
      options: optionsOf(doc, locale),
      variants: variantsOf(doc),
      components: doc.components ?? [],
      attributes: await attributesOf(doc),
      ...(doc.colorway ? { colorway: { ...doc.colorway, label: (locale === 'ur' && ownUr?.colorwayLabel) || doc.colorway.label } } : {}),
      siblings: sibRows.flatMap((s) => {
        const c = sibCards.find((x) => x.id === s.id)
        return c && s.colorwayLabel ? [{ handle: s.handle, label: s.colorwayLabel, swatch: /** @type {import('@noor/contract').Swatch} */ (s.colorwaySwatch), image: c.primaryImage, current: s.id === doc.id }] : []
      }),
      ...(doc.sizeChartId ? { sizeChartId: doc.sizeChartId } : {}),
      ...(doc.customSizeSchemaId ? { customSizeSchemaId: doc.customSizeSchemaId } : {}),
      ...(doc.fit ? { fit: doc.fit } : {}),
      ...(doc.madeToOrder
        ? {
            madeToOrder: {
              leadMinDays: doc.madeToOrder.leadMinDays,
              leadMaxDays: doc.madeToOrder.leadMaxDays,
              label: doc.madeToOrder.label || `Made for you in ${doc.madeToOrder.leadMinDays}–${doc.madeToOrder.leadMaxDays} days`,
              returnable: doc.madeToOrder.returnable,
              ...(dep === undefined ? {} : { depositPercent: dep }),
            },
          }
        : {}),
      ...(bundle ? { bundle } : {}),
      badges: card?.badges ?? [],
      ...(card?.rating ? { rating: card.rating } : {}),
      delivery: {
        ...(facts.defaultEta ? { etaMinDays: facts.defaultEta.minDays, etaMaxDays: facts.defaultEta.maxDays } : {}),
        codAvailable: facts.codAvailable ?? false,
        ...(facts.freeAboveFrom ? { freeAbove: facts.freeAboveFrom } : {}),
      },
      seo: doc.seo ?? {},
      updatedAt: doc.updatedAt,
    }
  }

  return {
    // ================================ products ================================
    /**
     * A product by handle or id. An old handle answers with where it went. A preview token opens any status of the product it was made for.
     * @param {{ handleOrId: string, preview?: string, locale?: Locale }} q
     */
    async getProduct({ handleOrId, preview, locale = 'en' }) {
      const row = (await db.select().from(products).where(UUID.test(handleOrId) ? eq(products.id, handleOrId) : eq(products.handle, handleOrId)))[0]
      if (!row) {
        const to = await redirectFor(handleOrId, 'product')
        const target = to ? (await db.select({ handle: products.handle, status: products.status }).from(products).where(eq(products.id, to.entityId)))[0] : undefined
        if (target?.status === 'active') return { redirect: target.handle, product: undefined, previewing: false }
        throw new DomainError('not_found')
      }
      const previewing = !!preview && verifyPreview(preview) === row.id
      if (row.status !== 'active' && !previewing) throw new DomainError('not_found')
      const doc = (await loadProducts(db, [row.id], { media, stock }))[0]
      if (!doc) throw new DomainError('not_found')
      return { redirect: undefined, product: await detailOf(doc, locale), previewing }
    },

    /** `relatedIds` first, then the best sellers of the same primary category. @param {string} id @param {number} limit @param {Locale} locale */
    async listRelated(id, limit, locale = 'en') {
      const me = (await db.select().from(products).where(and(eq(products.id, id), eq(products.status, 'active'))))[0]
      if (!me) throw new DomainError('not_found')
      const chosen = (await db.select().from(productRelated).where(eq(productRelated.productId, id)).orderBy(asc(productRelated.sortOrder))).map((r) => r.relatedProductId)
      const live = chosen.length ? new Set((await db.select({ id: products.id }).from(products).where(and(inArray(products.id, chosen), eq(products.status, 'active')))).map((p) => p.id)) : new Set()
      const ids = chosen.filter((c) => live.has(c)).slice(0, limit)
      if (ids.length < limit) {
        const more = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.primaryCategoryId, me.primaryCategoryId), eq(products.status, 'active'), ne(products.id, id), ids.length ? sql`${products.id} not in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})` : undefined))
          .orderBy(desc(products.salesCount), asc(products.id))
          .limit(limit - ids.length)
        ids.push(...more.map((m) => m.id))
      }
      return { items: await listing.summariesOf(db, ids, locale) }
    },

    // ================================ categories ================================
    /** The visible tree with the number of live products in each branch; a branch with none is left out. @param {Locale} locale */
    async listCategories(locale = 'en') {
      const all = visibleOf(await loadCategories())
      const tagged = await db.execute(sql`select pc.category_id as category, pc.product_id as product from product_categories pc join products p on p.id = pc.product_id where p.status = 'active'`)
      const rows = /** @type {{ category: string, product: string }[]} */ (/** @type {unknown} */ (tagged[0]))
      const images = await media.imagesFor(all.flatMap((c) => (c.imageMediaId ? [c.imageMediaId] : [])))
      /** @param {string | null} parent @returns {import('@noor/contract').CategoryNode[]} */
      const build = (parent) =>
        all.filter((c) => c.parentId === parent).map((c) => {
          const children = build(c.id)
          const below = new Set([c.id])
          const walk = (/** @type {typeof children} */ nodes) => nodes.forEach((n) => { below.add(n.id); walk(n.children) })
          walk(children)
          return {
            id: c.id, handle: c.handle, name: ur(c, locale, 'name') ?? c.name,
            ...(c.imageMediaId && images[c.imageMediaId] ? { image: images[c.imageMediaId] } : {}),
            productCount: new Set(rows.filter((r) => below.has(r.category)).map((r) => r.product)).size,
            children,
          }
          // a branch with no live product is not offered anywhere (navigation, home, footer, /categories); its own page still opens by address
        }).filter((n) => n.productCount > 0)
      return { items: build(null) }
    },

    /** @param {string} handle @param {Locale} locale */
    async getCategory(handle, locale = 'en') {
      const every = await loadCategories()
      const all = visibleOf(every)
      const c = all.find((x) => x.handle === handle)
      if (!c) {
        const to = await redirectFor(handle, 'category')
        const target = to ? all.find((x) => x.id === to.entityId) : undefined
        if (target) return { redirectTo: target.handle }
        throw new DomainError('not_found')
      }
      const image = c.imageMediaId ? (await media.imagesFor([c.imageMediaId]))[c.imageMediaId] : undefined
      return {
        id: c.id, handle: c.handle, name: ur(c, locale, 'name') ?? c.name,
        ...(ur(c, locale, 'description') ?? c.description ? { description: ur(c, locale, 'description') ?? c.description } : {}),
        ...(image ? { image } : {}),
        breadcrumb: pathTo(every, c.id, locale),
        children: all.filter((x) => x.parentId === c.id).map((x) => ({ handle: x.handle, name: ur(x, locale, 'name') ?? x.name })),
        seo: { ...(c.seoTitle ? { title: c.seoTitle } : {}), ...(c.seoDescription ? { description: c.seoDescription } : {}) },
      }
    },

    // ================================ collections ================================
    /** Active collections whose window is open. @param {{ featured?: boolean, limit?: number, locale?: Locale }} q */
    async listCollections({ featured, limit = 24, locale = 'en' }) {
      const at = now()
      const rows = await db
        .select()
        .from(collections)
        .where(and(eq(collections.status, 'active'), featured ? eq(collections.featured, true) : undefined, or(isNull(collections.startsAt), sql`${collections.startsAt} <= ${at}`), or(isNull(collections.endsAt), sql`${collections.endsAt} > ${at}`)))
        .orderBy(desc(collections.featured), desc(collections.updatedAt), asc(collections.id))
        .limit(limit)
      const images = await media.imagesFor(rows.flatMap((c) => (c.imageMediaId ? [c.imageMediaId] : [])))
      return { items: rows.map((c) => ({ id: c.id, handle: c.handle, title: ur(c, locale, 'title') ?? c.title, ...(c.imageMediaId && images[c.imageMediaId] ? { image: images[c.imageMediaId] } : {}) })) }
    },

    /** @param {string} handle @param {Locale} locale */
    async getCollection(handle, locale = 'en') {
      const at = now().getTime()
      const live = (/** @type {typeof collections.$inferSelect} */ c) => c.status === 'active' && (!c.startsAt || c.startsAt.getTime() <= at) && (!c.endsAt || c.endsAt.getTime() > at)
      const c = (await db.select().from(collections).where(eq(collections.handle, handle)))[0]
      if (!c || !live(c)) {
        const to = c ? null : await redirectFor(handle, 'collection')
        const target = to ? (await db.select().from(collections).where(eq(collections.id, to.entityId)))[0] : undefined
        if (target && live(target)) return { redirectTo: target.handle }
        throw new DomainError('not_found')
      }
      const image = c.imageMediaId ? (await media.imagesFor([c.imageMediaId]))[c.imageMediaId] : undefined
      return {
        id: c.id, handle: c.handle, title: ur(c, locale, 'title') ?? c.title,
        ...(image ? { image } : {}),
        ...(ur(c, locale, 'description') ?? c.description ? { description: ur(c, locale, 'description') ?? c.description } : {}),
        seo: { ...(c.seoTitle ? { title: c.seoTitle } : {}), ...(c.seoDescription ? { description: c.seoDescription } : {}) },
      }
    },

    // ================================ charts and forms ================================
    async listSizeCharts() {
      const rows = await db.select().from(sizeCharts).orderBy(asc(sizeCharts.title))
      const images = await media.imagesFor(rows.flatMap((c) => (c.guideMediaId ? [c.guideMediaId] : [])))
      return { items: rows.map((c) => toChart(c, images)) }
    },
    /** @param {string} id */
    async getSizeChart(id) {
      const c = (await db.select().from(sizeCharts).where(eq(sizeCharts.id, id)))[0]
      if (!c) throw new DomainError('not_found')
      return toChart(c, await media.imagesFor(c.guideMediaId ? [c.guideMediaId] : []))
    },
    /** @param {string} id */
    async getFormSchema(id) {
      const f = (await db.select().from(formSchemas).where(eq(formSchemas.id, id)))[0]
      if (!f) throw new DomainError('not_found')
      return { id: f.id, ...(f.title ? { title: f.title } : {}), fields: /** @type {import('@noor/contract').FormField[]} */ (f.fields), allowNotes: f.allowNotes }
    },

    // ================================ back in stock ================================
    /**
     * Asking again is the same as asking once. A phone may ask for three variants a day. The feature can be switched off in the store settings.
     * @param {{ variantId: string, phone: string, locale?: Locale }} s @param {(bucket: string, by: 'phone', subject: string) => Promise<void>} limit
     */
    async subscribeBackInStock(s, limit) {
      if (!(await notifyEnabled())) throw new DomainError('not_found')
      const v = (await db.select({ enabled: variants.enabled, status: products.status }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(eq(variants.id, s.variantId)))[0]
      if (!v || !v.enabled || v.status !== 'active') throw new DomainError('not_found')
      await limit('notify', 'phone', subjectHash(s.phone))
      await subscribe(s)
    },

    // ================================ sitemap ================================
    /** Everything crawlers should see, in a fixed order, paged by position. @param {{ limit: number, cursor?: string }} q */
    async sitemapEntries({ limit, cursor }) {
      const offset = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0
      const at = now()
      const [cats, activeProducts, cols, livePages] = await Promise.all([
        loadCategories().then(visibleOf),
        db.select().from(products).where(eq(products.status, 'active')).orderBy(asc(products.handle)),
        db.select().from(collections).where(and(eq(collections.status, 'active'), or(isNull(collections.startsAt), sql`${collections.startsAt} <= ${at}`), or(isNull(collections.endsAt), sql`${collections.endsAt} > ${at}`))).orderBy(asc(collections.handle)),
        db.select().from(pages).where(eq(pages.status, 'active')).orderBy(asc(pages.slug)),
      ])
      const firstPictures = await db.execute(sql`select pm.product_id as product, pm.media_id as media from product_media pm where pm.sort_order = 0 and pm.product_id in (select id from products where status = 'active')`)
      const pics = new Map(/** @type {{ product: string, media: string }[]} */ (/** @type {unknown} */ (firstPictures[0])).map((r) => [r.product, r.media]))
      const images = await media.imagesFor([...pics.values()])
      /** @type {{ loc: string, lastmod: string, image?: string, type: 'home' | 'category' | 'collection' | 'product' | 'page' | 'facet' }[]} */
      const entries = [{ loc: '/', lastmod: (activeProducts.map((p) => p.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? at).toISOString(), type: 'home' }]
      // a category with no live product is a thin page: crawlers are not sent to it (it is also left out of the public tree)
      const live = /** @type {Set<string>} */ (new Set())
      const mark = (/** @type {import('@noor/contract').CategoryNode[]} */ nodes) => nodes.forEach((n) => { live.add(n.handle); mark(n.children) })
      mark((await this.listCategories()).items)
      for (const c of cats) if (live.has(c.handle)) entries.push({ loc: `/c/${c.handle}`, lastmod: c.updatedAt.toISOString(), type: 'category' })
      for (const c of cols) entries.push({ loc: `/collections/${c.handle}`, lastmod: c.updatedAt.toISOString(), type: 'collection' })
      for (const p of activeProducts) {
        const img = pics.get(p.id) ? images[/** @type {string} */ (pics.get(p.id))]?.src : undefined
        entries.push({ loc: `/p/${p.handle}`, lastmod: p.updatedAt.toISOString(), ...(img ? { image: img } : {}), type: 'product' })
      }
      for (const p of livePages) entries.push({ loc: `/pages/${p.slug}`, lastmod: p.updatedAt.toISOString(), type: 'page' })
      // single-value filter pages a category marks as indexable (DOC-06.9 section 5), when something is on them
      const indexable = await db.select().from(categoryAttributes).where(eq(categoryAttributes.seoIndexable, true))
      for (const f of indexable) {
        const cat = cats.find((c) => c.id === f.categoryId)
        if (!cat) continue
        const below = [cat.id]
        for (let i = 0; i < below.length; i++) for (const c of cats) if (c.parentId === below[i]) below.push(c.id)
        const found = /** @type {{ attribute: string, value: string }[]} */ (/** @type {unknown} */ ((await db.execute(sql`select a.code as attribute, av.code as value from product_attribute_values pav
          join attributes a on a.id = pav.attribute_id join attribute_values av on av.id = pav.value_id join products p on p.id = pav.product_id
          where pav.attribute_id = ${f.attributeId} and p.status = 'active' and p.id in (select product_id from product_categories where category_id in (${sql.join(below.map((b) => sql`${b}`), sql`, `)}))
          group by a.code, av.code order by av.code`))[0]))
        for (const v of found) entries.push({ loc: `/c/${cat.handle}?attr.${v.attribute}=${v.value}`, lastmod: cat.updatedAt.toISOString(), type: 'facet' })
      }
      const page = entries.slice(offset, offset + limit)
      return { items: page, ...(offset + limit < entries.length ? { nextCursor: String(offset + limit) } : {}), total: entries.length }
    },

  }
}

/** @param {typeof sizeCharts.$inferSelect} c @param {Record<string, import('@noor/contract').Image>} images */
const toChart = (c, images) => ({
  id: c.id,
  title: c.title,
  unit: /** @type {'in' | 'cm'} */ (c.unit),
  ...(c.notes ? { notes: c.notes } : {}),
  ...(c.guideMediaId && images[c.guideMediaId] ? { guideImage: images[c.guideMediaId] } : {}),
  tables: /** @type {import('@noor/contract').z.infer<typeof import('@noor/contract').SizeChartPublic>['tables']} */ (c.tables),
})


// The public product listing: one filter builder for items, total, facets and price presets (plan/10-api/02-catalog-public.md sections 3 and 7),
// keyset cursors so a walk returns every product once, and the `ProductSummary` cards.
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { DomainError } from '../../platform/errors.js'
import { now } from '../../platform/clock.js'
import { media as mediaTable } from '../../db/schema/media.js'
import { attributeValues, attributes, categories } from '../../db/schema/taxonomy.js'
import { collections, productMedia, products } from '../../db/schema/products.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {import('@noor/contract').ProductSummary} ProductSummary */
/** @typedef {import('@noor/contract').EnumValue<'colorFamily'>} ColorFamily */

const DAY = 86_400_000
const SORTS = new Set(['featured', 'newest', 'price_asc', 'price_desc', 'bestselling', 'relevance'])
const issue = (/** @type {string} */ path, /** @type {import('@noor/contract').FieldIssueCode} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })

/** Representative colours for the colour facet. */
const FAMILY_HEX = /** @type {Record<string, string>} */ ({
  black: '#111111', white: '#FFFFFF', grey: '#9A9A9A', beige: '#D8C3A5', brown: '#7B4B2A', red: '#C0392B', pink: '#E58AA8', orange: '#E67E22',
  yellow: '#F1C40F', green: '#2E8B57', blue: '#2F5DA8', purple: '#7D3C98', gold: '#C9A227', silver: '#BFC3C7', multi: '#8E8E8E',
})
const humanise = (/** @type {string} */ v) => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** An enabled variant a customer can buy now: it does not count stock, or it has some left. */
const AVAILABLE = sql`(v.stock_mode <> 'counted' or exists (select 1 from inventory_levels il where il.variant_id = v.id and il.on_hand - il.reserved > 0))`

/** @param {string} value */
const toCursor = (value) => Buffer.from(value).toString('base64url')
/** @param {string | undefined} cursor */
function fromCursor(cursor) {
  if (!cursor) return null
  try {
    const v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    return v && typeof v === 'object' ? /** @type {Record<string, any>} */ (v) : null
  } catch {
    return null
  }
}

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {ReturnType<typeof import('../search/service.js').createSearch>} deps.search
 * @param {(categoryId: string) => Promise<{ attributeId: string, seoIndexable: boolean }[]>} deps.filtersOf
 */
export function createListing({ db, media, search, filtersOf }) {
  /** Rows of a raw SELECT. @param {import('drizzle-orm').SQL} query @returns {Promise<any[]>} */
  const select = async (query) => /** @type {any[]} */ (/** @type {unknown} */ ((await db.execute(query))[0]))

  // ================================ cards ================================
  /**
   * `ProductSummary` cards for these products, in the order given. Products that are not active are left out.
   * @param {Db} x @param {string[]} ids @param {'en' | 'ur'} [locale]
   * @returns {Promise<ProductSummary[]>}
   */
  async function summariesOf(x, ids, locale = 'en') {
    if (!ids.length) return []
    const rows = await x.select().from(products).where(and(inArray(products.id, ids), eq(products.status, 'active')))
    const links = await x.select().from(productMedia).where(inArray(productMedia.productId, rows.map((r) => r.id))).orderBy(asc(productMedia.sortOrder))
    const imageIds = links.map((l) => l.mediaId)
    const [images, alts] = await Promise.all([media.imagesFor(imageIds), imageIds.length ? x.select({ id: mediaTable.id, alt: mediaTable.alt }).from(mediaTable).where(inArray(mediaTable.id, imageIds)) : []])
    const altOf = new Map(alts.map((a) => [a.id, a.alt]))
    const styleIds = [...new Set(rows.flatMap((r) => (r.styleId ? [r.styleId] : [])))]
    const siblings = styleIds.length ? await x.select().from(products).where(and(inArray(products.styleId, styleIds), eq(products.status, 'active'))).orderBy(asc(products.colorwayLabel)) : []
    const byId = new Map(rows.map((r) => [r.id, r]))
    const cutoff = now().getTime() - 30 * DAY
    const picture = (/** @type {typeof links[number] | undefined} */ l) => {
      const img = l ? images[l.mediaId] : undefined
      return l && img ? { ...img, alt: l.alt || altOf.get(l.mediaId) || img.alt } : undefined
    }
    /** @type {ProductSummary[]} */
    const out = []
    for (const id of ids) {
      const p = byId.get(id)
      if (!p) continue
      const mine = links.filter((l) => l.productId === id)
      const primary = picture(mine[0])
      if (!primary) continue // an active product always has a picture; a half-processed one is not shown
      const ur = /** @type {{ ur?: { title?: string } } | null} */ (p.i18n)?.ur
      const staff = /** @type {string[] | null} */ (p.badges) ?? []
      /** @type {ProductSummary['badges']} */
      const badges = []
      if (staff.includes('new') || (p.publishedAt && p.publishedAt.getTime() >= cutoff)) badges.push('new')
      if (p.compareAtMinMinor !== null) badges.push('sale')
      if (staff.includes('bestseller')) badges.push('bestseller')
      if (staff.includes('limited')) badges.push('limited')
      if (p.kind === 'made_to_order') badges.push('made_to_order')
      if (p.stockStatus === 'sold_out') badges.push('sold_out')
      const secondary = picture(mine[1])
      out.push({
        id: p.id,
        handle: p.handle,
        title: (locale === 'ur' && ur?.title) || p.title,
        ...(p.brand ? { brand: p.brand } : {}),
        kind: /** @type {ProductSummary['kind']} */ (p.kind),
        primaryImage: primary,
        ...(secondary ? { secondaryImage: secondary } : {}),
        priceFrom: { amount: p.priceMinMinor, currency: 'PKR' },
        ...(p.priceMaxMinor > p.priceMinMinor ? { priceTo: { amount: p.priceMaxMinor, currency: 'PKR' } } : {}),
        ...(p.compareAtMinMinor === null ? {} : { compareAtFrom: { amount: p.compareAtMinMinor, currency: 'PKR' } }),
        badges,
        stockStatus: /** @type {ProductSummary['stockStatus']} */ (p.stockStatus),
        colorways: p.styleId
          ? siblings.filter((s) => s.styleId === p.styleId && s.colorwayLabel).map((s) => ({ handle: s.handle, label: s.colorwayLabel ?? '', swatch: /** @type {import('@noor/contract').Swatch} */ (s.colorwaySwatch), current: s.id === p.id }))
          : [],
      })
    }
    return out
  }

  // ================================ filters ================================
  /**
   * Reads the query: named filters, `attr.<code>` filters (checked against the attributes that exist), category and collection (must be
   * visible), and what the sort may be.
   * @param {Record<string, any>} query
   */
  async function resolve(query) {
    // a wishlist lookup ignores every other filter (DOC-10.2 section 3)
    if (query.ids?.length) return { query, attrs: /** @type {Map<string, string[]>} */ (new Map()), category: null, collection: null, text: null, known: /** @type {{ id: string }[]} */ ([]) }
    const named = new Set(['category', 'collection', 'ids', 'q', 'onlyNew', 'onlySale', 'kind', 'size', 'color', 'inStock', 'priceMin', 'priceMax', 'sort', 'limit', 'cursor', 'facets', 'locale'])
    /** @type {Map<string, string[]>} */
    const attrs = new Map()
    for (const [key, raw] of Object.entries(query)) {
      if (named.has(key)) continue
      if (!key.startsWith('attr.')) throw issue(key, 'unrecognized_keys')
      attrs.set(key.slice(5), String(raw).split(',').filter(Boolean))
    }
    const known = attrs.size ? await db.select().from(attributes).where(inArray(attributes.code, [...attrs.keys()])) : []
    for (const code of attrs.keys()) if (!known.some((a) => a.code === code)) throw issue(`attr.${code}`, 'invalid_format')
    if (query.sort && !SORTS.has(query.sort)) throw issue('sort', 'invalid_format')
    if (query.sort === 'relevance' && !query.q) throw issue('sort', 'invalid_format')
    if (query.priceMin !== undefined && query.priceMax !== undefined && query.priceMin > query.priceMax) throw issue('priceMin', 'too_big')

    /** @type {{ id: string, handle: string, name: string, descendants: string[] } | null} */
    let category = null
    if (query.category) {
      const all = await db.select().from(categories)
      const row = all.find((c) => c.handle === query.category)
      const byId = new Map(all.map((c) => [c.id, c]))
      const visible = (/** @type {typeof all[number]} */ c) => { for (let x = /** @type {typeof c | undefined} */ (c); x; x = x.parentId ? byId.get(x.parentId) : undefined) if (!x.visible) return false; return true }
      if (!row || !visible(row)) throw new DomainError('not_found')
      const below = [row.id]
      for (let i = 0; i < below.length; i++) for (const c of all) if (c.parentId === below[i] && c.visible) below.push(c.id)
      category = { id: row.id, handle: row.handle, name: row.name, descendants: below }
    }
    /** @type {{ id: string } | null} */
    let collection = null
    if (query.collection) {
      const row = (await db.select().from(collections).where(eq(collections.handle, query.collection)))[0]
      const t = now().getTime()
      if (!row || row.status !== 'active' || (row.startsAt && row.startsAt.getTime() > t) || (row.endsAt && row.endsAt.getTime() <= t)) throw new DomainError('not_found')
      collection = { id: row.id }
    }
    const text = query.q ? await search.predicate(query.q) : null
    return { query, attrs, category, collection, text, known }
  }

  /** @typedef {Awaited<ReturnType<typeof resolve>>} Resolved */

  /**
   * The WHERE conditions on `products`, all but the one for `skip` (so a facet can count "what each other value would give").
   * @param {Resolved} r @param {string} [skip] a filter key: 'kind', 'size', 'color', 'inStock', 'price' or 'attr.<code>'
   * @returns {import('drizzle-orm').SQL[]}
   */
  function conditions(r, skip) {
    const q = r.query
    const out = [sql`${products.status} = 'active'`]
    if (q.ids?.length) return [...out, inArray(products.id, q.ids)]
    if (r.category) out.push(sql`${products.id} in (select product_id from product_categories where category_id in (${sql.join(r.category.descendants.map((id) => sql`${id}`), sql`, `)}))`)
    if (r.collection) out.push(sql`${products.id} in (select product_id from collection_products where collection_id = ${r.collection.id})`)
    if (r.text) out.push(r.text.empty ? sql`1 = 0` : /** @type {import('drizzle-orm').SQL} */ (r.text.where))
    if (q.onlyNew) out.push(sql`${products.publishedAt} >= ${new Date(now().getTime() - 30 * DAY)}`)
    if (q.onlySale) out.push(sql`${products.compareAtMinMinor} is not null`)
    if (q.kind?.length && skip !== 'kind') out.push(inArray(products.kind, q.kind))
    if (q.color?.length && skip !== 'color') out.push(inArray(products.colorFamily, q.color))
    if (q.inStock && skip !== 'inStock') out.push(sql`${products.stockStatus} <> 'sold_out'`)
    if (skip !== 'price') {
      if (q.priceMin !== undefined) out.push(sql`${products.priceMinMinor} >= ${q.priceMin}`)
      if (q.priceMax !== undefined) out.push(sql`${products.priceMinMinor} <= ${q.priceMax}`)
    }
    if (q.size?.length && skip !== 'size') {
      out.push(sql`${products.id} in (select v.product_id from variants v join variant_option_values vov on vov.variant_id = v.id join product_option_values pov on pov.id = vov.option_value_id join size_system_values ssv on ssv.id = pov.size_system_value_id where v.enabled = 1 and ssv.label in (${sql.join(q.size.map((/** @type {string} */ s) => sql`${s}`), sql`, `)}) and ${AVAILABLE})`)
    }
    for (const [code, values] of r.attrs) {
      if (skip === `attr.${code}` || !values.length) continue
      out.push(sql`${products.id} in (select pav.product_id from product_attribute_values pav join attribute_values av on av.id = pav.value_id join attributes a on a.id = pav.attribute_id where a.code = ${code} and av.code in (${sql.join(values.map((v) => sql`${v}`), sql`, `)}))`)
    }
    return out
  }
  const where = (/** @type {Resolved} */ r, /** @type {string} */ skip = '') => sql.join(conditions(r, skip), sql` and `)

  // ================================ ordering and cursors ================================
  /** @param {Resolved} r */
  function sortOf(r) {
    const q = r.query
    const sort = q.sort ?? (q.q ? 'relevance' : r.category || r.collection ? 'featured' : 'newest')
    const published = sql`timestampdiff(microsecond, '1970-01-01', ${products.publishedAt})`
    /** @type {{ name: string, expr: import('drizzle-orm').SQL, dir: 'asc' | 'desc' }[]} */
    let keys
    switch (sort) {
      case 'newest': keys = [{ name: 'p', expr: published, dir: 'desc' }]; break
      case 'price_asc': keys = [{ name: 'p', expr: sql`${products.priceMinMinor}`, dir: 'asc' }]; break
      case 'price_desc': keys = [{ name: 'p', expr: sql`${products.priceMinMinor}`, dir: 'desc' }]; break
      case 'bestselling': keys = [{ name: 'p', expr: sql`${products.salesCount}`, dir: 'desc' }]; break
      case 'featured':
        keys = r.collection
          ? [{ name: 'p', expr: sql`(select cp.sort_order from collection_products cp where cp.collection_id = ${r.collection.id} and cp.product_id = ${products.id})`, dir: 'asc' }]
          : [{ name: 'r', expr: sql`${products.featuredRank}`, dir: 'desc' }, { name: 'p', expr: published, dir: 'desc' }]
        break
      default: keys = [] // relevance: the score has no stable keyset, so it pages by offset
    }
    return { sort, keys }
  }

  /** `(k1 < v1) or (k1 = v1 and k2 < v2) ...` for the keys followed by id ascending. @param {ReturnType<typeof sortOf>['keys']} keys @param {Record<string, any>} cursor */
  function after(keys, cursor) {
    const cols = [...keys.map((k) => ({ expr: k.expr, dir: k.dir, value: cursor[k.name] })), { expr: sql`${products.id}`, dir: /** @type {'asc'} */ ('asc'), value: cursor.id }]
    const ors = cols.map((c, i) => {
      const eqs = cols.slice(0, i).map((e) => sql`${e.expr} = ${e.value}`)
      return sql`(${sql.join([...eqs, c.dir === 'asc' ? sql`${c.expr} > ${c.value}` : sql`${c.expr} < ${c.value}`], sql` and `)})`
    })
    return sql`(${sql.join(ors, sql` or `)})`
  }

  // ================================ facets ================================
  /** @param {Resolved} r */
  async function facetsOf(r) {
    const q = r.query
    /** @type {import('@noor/contract').z.infer<typeof import('@noor/contract').Facet>[]} */
    const out = []
    const rowsOf = select

    const kinds = await rowsOf(sql`select kind as value, count(*) as n from products where ${where(r, 'kind')} group by kind order by n desc, kind`)
    out.push({ key: 'kind', label: 'Type', display: 'checkbox', values: kinds.map((k) => ({ value: k.value, label: humanise(k.value), count: Number(k.n), selected: !!q.kind?.includes(k.value) })) })

    const sizes = await rowsOf(sql`select ssv.label as value, min(ssv.sort_order) as ord, count(distinct v.product_id) as n
      from variants v join variant_option_values vov on vov.variant_id = v.id join product_option_values pov on pov.id = vov.option_value_id join size_system_values ssv on ssv.id = pov.size_system_value_id
      where v.enabled = 1 and ${AVAILABLE} and v.product_id in (select id from products where ${where(r, 'size')}) group by ssv.label order by ord, ssv.label`)
    out.push({ key: 'size', label: 'Size', display: 'buttons', values: sizes.map((s) => ({ value: s.value, label: s.value, count: Number(s.n), selected: !!q.size?.some((/** @type {string} */ x) => x.toLowerCase() === String(s.value).toLowerCase()) })) })

    const colors = await rowsOf(sql`select color_family as value, count(*) as n from products where color_family is not null and ${where(r, 'color')} group by color_family order by n desc, color_family`)
    out.push({ key: 'color', label: 'Colour', display: 'swatch', values: colors.map((c) => ({ value: c.value, label: humanise(c.value), count: Number(c.n), swatch: { hex: [FAMILY_HEX[c.value] ?? '#8E8E8E'] }, selected: !!q.color?.includes(c.value) })) })

    const [stock] = await rowsOf(sql`select count(*) as n from products where stock_status <> 'sold_out' and ${where(r, 'inStock')}`)
    out.push({ key: 'inStock', label: 'In stock', display: 'checkbox', values: [{ value: '1', label: 'In stock only', count: Number(stock?.n ?? 0), selected: !!q.inStock }] })

    // the filters of the category (or of its nearest ancestor that has any); outside a category there are none
    if (r.category) {
      const wanted = await filtersOf(r.category.id)
      const defs = wanted.length ? await db.select().from(attributes).where(inArray(attributes.id, wanted.map((w) => w.attributeId))) : []
      const values = defs.length ? await db.select().from(attributeValues).where(inArray(attributeValues.attributeId, defs.map((d) => d.id))).orderBy(asc(attributeValues.sortOrder)) : []
      for (const w of wanted) {
        const def = defs.find((d) => d.id === w.attributeId)
        if (!def || def.type === 'number') continue
        const counts = new Map(
          /** @type {{ code: string, n: number }[]} */ (
            await rowsOf(sql`select av.code as code, count(distinct pav.product_id) as n from product_attribute_values pav join attribute_values av on av.id = pav.value_id
              where pav.attribute_id = ${def.id} and pav.product_id in (select id from products where ${where(r, `attr.${def.code}`)}) group by av.code`)
          ).map((c) => [c.code, Number(c.n)]),
        )
        const chosen = r.attrs.get(def.code) ?? []
        out.push({
          key: `attr.${def.code}`, label: def.label, display: /** @type {any} */ (def.display), seoIndexable: w.seoIndexable,
          values: values.filter((v) => v.attributeId === def.id).map((v) => ({ value: v.code, label: v.label, count: counts.get(v.code) ?? 0, ...(v.swatch ? { swatch: /** @type {import('@noor/contract').Swatch} */ (v.swatch) } : {}), selected: chosen.includes(v.code) })),
        })
      }
    }
    return out
  }

  /** Four price ranges from the quartiles of what matches (ignoring the price filter itself), rounded to Rs. 500. @param {Resolved} r */
  async function pricePresets(r) {
    const prices = (await select(sql`select price_min_minor as p from products where price_min_minor > 0 and ${where(r, 'price')} order by price_min_minor`)).map((x) => Number(x.p))
    if (prices.length < 4) return []
    const step = 50_000
    const at = (/** @type {number} */ f) => Math.round((prices[Math.min(prices.length - 1, Math.floor(prices.length * f))] ?? 0) / step) * step
    const cuts = [...new Set([at(0.25), at(0.5), at(0.75)])].filter((c) => c > 0)
    if (!cuts.length) return []
    const ranges = [{ max: cuts[0] }, ...cuts.slice(1).map((c, i) => ({ min: /** @type {number} */ (cuts[i]), max: c })), { min: /** @type {number} */ (cuts.at(-1)) }]
    return /** @type {{ min?: number, max?: number }[]} */ (ranges)
  }

  return {
    summariesOf,
    resolve,

    /**
     * @param {Record<string, any>} query a parsed `ListingQuery`
     * @param {{ locale?: 'en' | 'ur' }} [opts]
     */
    async list(query, { locale = 'en' } = {}) {
      const r = await resolve(query)
      const { sort, keys } = sortOf(r)
      const limit = Math.min(48, query.limit ?? 24)
      const cursor = fromCursor(query.cursor)
      if (query.cursor && !cursor) throw issue('cursor', 'invalid_format')

      const [{ n: total } = { n: 0 }] = await select(sql`select count(*) as n from products where ${where(r)}`)
      /** @type {string[]} */
      let ids
      let next = ''
      if (query.ids?.length) {
        const found = await db.select({ id: products.id }).from(products).where(sql`${where(r)}`)
        const live = new Set(found.map((f) => f.id))
        ids = query.ids.filter((/** @type {string} */ id) => live.has(id)).slice(0, limit)
      } else if (sort === 'relevance') {
        if (r.text?.empty) ids = []
        else {
          const offset = Number(cursor?.o ?? 0)
          const rows = await select(
            sql`select products.id as id from products left join product_search ps on ps.product_id = products.id where ${where(r)}
              order by ${r.text?.order ?? sql`0`} desc, products.sales_count desc, products.id limit ${limit + 1} offset ${offset}`,
          )
          ids = rows.slice(0, limit).map((x) => x.id)
          if (rows.length > limit) next = toCursor(JSON.stringify({ o: offset + limit }))
        }
      } else {
        const sel = keys.map((k) => sql`${k.expr} as ${sql.raw(`k_${k.name}`)}`)
        const keyset = cursor ? [after(keys, cursor)] : []
        const order = [...keys.map((k) => sql`${k.expr} ${sql.raw(k.dir)}`), sql`products.id asc`]
        const rows = await select(
          sql`select products.id as id${sel.length ? sql`, ${sql.join(sel, sql`, `)}` : sql``} from products where ${sql.join([where(r), ...keyset], sql` and `)}
            order by ${sql.join(order, sql`, `)} limit ${limit + 1}`,
        )
        const page = rows.slice(0, limit)
        ids = page.map((x) => x.id)
        const last = page.at(-1)
        if (rows.length > limit && last) next = toCursor(JSON.stringify({ id: last.id, ...Object.fromEntries(keys.map((k) => [k.name, Number(last[`k_${k.name}`])])) }))
      }

      const items = await summariesOf(db, ids, locale)
      if (r.text && total === 0 && !query.cursor) await search.logMiss(query.q)
      const wantFacets = query.facets !== false && !query.ids?.length
      return {
        items,
        total: Number(total),
        ...(next ? { nextCursor: next } : {}),
        ...(wantFacets ? { facets: await facetsOf(r), pricePresets: await pricePresets(r) } : {}),
      }
    },
  }
}

// Performance data (plan/13-quality.md section 6.2): about 3,000 products and 25,000 variants with sizes, stock, attributes and pictures,
// written with bulk inserts (the services would take far too long) but in exactly the shape the services write. The same names and numbers
// on every full run; a second run only adds the products that are missing. Orders (20,000 in the plan) wait for the order tables.
import { eq, like } from 'drizzle-orm'
import { now } from '../platform/clock.js'
import { uuidv7 } from '../platform/ids.js'
import { inventoryLevels, inventoryMovements } from '../db/schema/inventory.js'
import { media } from '../db/schema/media.js'
import { productAttributeValues, productCategories, productMedia, productOptionValues, productOptions, productSizes, products, variantOptionValues, variants } from '../db/schema/products.js'
import { attributeValues, attributes, categories, sizeSystemValues, sizeSystems } from '../db/schema/taxonomy.js'

/** @typedef {import('../platform/db.js').Database['db']} Db */

/** A small seeded random generator, so every run builds the same shop. @param {number} seed */
function random(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ADJECTIVES = ['Embroidered', 'Printed', 'Classic', 'Festive', 'Luxe', 'Everyday', 'Digital', 'Hand-block', 'Zari', 'Pastel', 'Modern', 'Heritage']
const NOUNS = ['Lawn Suit', 'Kurta', 'Khaddar Set', 'Chiffon Dupatta', 'Co-ord Set', 'Waistcoat', 'Frock', 'Shalwar Kameez', 'Kolhapuri', 'Clutch', 'Shawl', 'Tunic']
const COLORS = [['red', 'Red'], ['blue', 'Blue'], ['green', 'Green'], ['pink', 'Pink'], ['black', 'Black'], ['white', 'White'], ['beige', 'Beige'], ['gold', 'Gold'], ['purple', 'Purple'], ['brown', 'Brown']]
const PACKS = ['Single', 'Pair']
const CHUNK = 1500

/**
 * @template T
 * @param {(rows: T[]) => Promise<unknown>} insert @param {T[]} rows
 */
async function inChunks(insert, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK))
}

/**
 * @param {Db} db
 * @param {{ search?: { reindexAll: () => Promise<number> }, count?: number, log?: (line: string) => void }} opts needs the demo structure (categories, attributes, sizes) to exist
 */
export async function seedPerf(db, { search, count = 3000, log = () => {} } = {}) {
  const started = Date.now()
  const rnd = random(20261005)
  const at = now()

  const cats = (await db.select().from(categories)).filter((c) => ['unstitched', 'stitched', 'bridal', 'footwear', 'accessories', 'men', 'kids'].includes(c.handle))
  if (!cats.length) throw new Error('the demo structure is missing: run the demo seed first (db:seed without --base-only)')
  const system = (await db.select().from(sizeSystems)).find((s) => s.name === "Women's stitched")
  const sizes = system ? await db.select().from(sizeSystemValues).where(eq(sizeSystemValues.sizeSystemId, system.id)).orderBy(sizeSystemValues.sortOrder) : []
  const attrRows = await db.select().from(attributes)
  const valueRows = await db.select().from(attributeValues)
  const valuesOf = (/** @type {string} */ code) => {
    const a = attrRows.find((x) => x.code === code)
    return a ? { attributeId: a.id, values: valueRows.filter((v) => v.attributeId === a.id) } : null
  }
  const fabric = valuesOf('fabric')
  const occasion = valuesOf('occasion')
  const piece = valuesOf('piece')

  // a small pool of pictures, shared by all perf products (no files: only the rows matter to the queries)
  const pool = /** @type {string[]} */ ([])
  const existingPerfMedia = await db.select({ id: media.id }).from(media).where(like(media.objectKey, 'media/perf/%'))
  pool.push(...existingPerfMedia.map((m) => m.id))
  while (pool.length < 12) {
    const id = uuidv7()
    await db.insert(media).values({ id, kind: 'image', status: 'ready', objectKey: `media/perf/${id}.jpg`, contentType: 'image/jpeg', bytes: 1000, width: 900, height: 1200, lqip: null, alt: 'Perf placeholder', createdAt: at })
    pool.push(id)
  }

  const have = new Set((await db.select({ h: products.handle }).from(products).where(like(products.handle, 'perf-%'))).map((p) => p.h))
  /** @type {(typeof products.$inferInsert)[]} */ const productRows = []
  /** @type {(typeof productCategories.$inferInsert)[]} */ const categoryRows = []
  /** @type {(typeof productMedia.$inferInsert)[]} */ const mediaRows = []
  /** @type {(typeof productOptions.$inferInsert)[]} */ const optionRows = []
  /** @type {(typeof productOptionValues.$inferInsert)[]} */ const valueRows2 = []
  /** @type {(typeof variants.$inferInsert)[]} */ const variantRows = []
  /** @type {(typeof variantOptionValues.$inferInsert)[]} */ const linkRows = []
  /** @type {(typeof inventoryLevels.$inferInsert)[]} */ const levelRows = []
  /** @type {(typeof inventoryMovements.$inferInsert)[]} */ const movementRows = []
  /** @type {(typeof productAttributeValues.$inferInsert)[]} */ const attrValueRows = []
  /** @type {(typeof productSizes.$inferInsert)[]} */ const sizeRows = []
  const pick = (/** @type {any[]} */ list) => list[Math.floor(rnd() * list.length)]

  for (let i = 0; i < count; i++) {
    const handle = `perf-${String(i).padStart(5, '0')}`
    const draw = rnd
    const category = pick(cats)
    const [family, familyName] = pick(COLORS)
    const title = `${pick(ADJECTIVES)} ${pick(NOUNS)} ${familyName} ${i}`
    const price = (Math.floor(draw() * 230) * 100 + 1500) * 100 // Rs. 1,500 .. 24,400 in whole hundreds
    const onSale = draw() < 0.2
    const status = draw() < 0.95 ? 'active' : 'draft'
    const twoOptions = draw() < 0.4
    const daysAgo = Math.floor(draw() * 200)
    const sales = Math.floor(draw() * draw() * 400)
    const stockRoll = draw()
    if (have.has(handle)) continue

    const productId = uuidv7()
    const optionId = uuidv7()
    const sizeValues = sizes.map((s) => ({ id: uuidv7(), label: s.label, sizeSystemValueId: s.id }))
    optionRows.push({ id: optionId, productId, name: 'Size', role: 'size', display: 'buttons', sizeSystemId: system?.id ?? null, sortOrder: 0, i18n: null })
    sizeValues.forEach((v, k) => valueRows2.push({ id: v.id, optionId, label: v.label, kind: 'standard', sizeSystemValueId: v.sizeSystemValueId, swatch: null, sortOrder: k, i18n: null }))
    /** @type {{ id: string }[]} */
    let packValues = []
    if (twoOptions) {
      const packId = uuidv7()
      optionRows.push({ id: packId, productId, name: 'Pack', role: 'other', display: 'select', sizeSystemId: null, sortOrder: 1, i18n: null })
      packValues = PACKS.map(() => ({ id: uuidv7() }))
      packValues.forEach((v, k) => valueRows2.push({ id: v.id, optionId: packId, label: PACKS[k] ?? '', kind: 'standard', sizeSystemValueId: null, swatch: null, sortOrder: k, i18n: null }))
    }

    /** @type {Map<string, boolean>} */
    const stocked = new Map()
    let lowest = Infinity
    let highest = 0
    let best = 0
    let order = 0
    for (const sv of sizeValues) {
      for (const pack of twoOptions ? packValues : [null]) {
        const variantId = uuidv7()
        const optionIds = pack ? [sv.id, pack.id] : [sv.id]
        const variantPrice = pack ? price + 150_000 : price
        lowest = Math.min(lowest, variantPrice)
        highest = Math.max(highest, variantPrice)
        variantRows.push({
          id: variantId, productId, sku: `PERF${i}-${sv.label}${pack ? `-${(PACKS[packValues.indexOf(pack)] ?? '')[0]}` : ''}`, optionKey: [...optionIds].sort().join('_'), priceMinor: variantPrice,
          compareAtMinor: onSale ? Math.round(variantPrice * 1.25 / 100) * 100 : null, stockMode: 'counted', preorderShipsAt: null, maxPerOrder: 10, enabled: true, sortOrder: order++, createdAt: at, updatedAt: at,
        })
        for (const optionValueId of optionIds) linkRows.push({ variantId, optionValueId })
        const onHand = stockRoll < 0.1 ? 0 : Math.floor(draw() * 30)
        best = Math.max(best, onHand)
        stocked.set(sv.sizeSystemValueId, !!stocked.get(sv.sizeSystemValueId) || onHand > 0)
        levelRows.push({ variantId, onHand, reserved: 0, updatedAt: at })
        if (onHand > 0) movementRows.push({ id: uuidv7(), variantId, delta: onHand, reason: 'initial', note: null, orderId: null, staffUserId: null, onHandAfter: onHand, createdAt: at })
      }
    }
    productRows.push({
      id: productId, handle, status, kind: category.handle === 'footwear' ? 'footwear' : category.handle === 'accessories' ? 'accessory' : category.handle === 'unstitched' ? 'unstitched' : 'stitched',
      title, brand: 'Rubaya', primaryCategoryId: category.id, colorwayLabel: familyName, colorFamily: family, colorwaySwatch: { hex: ['#888888'] },
      priceMinMinor: lowest, priceMaxMinor: highest, compareAtMinMinor: onSale ? Math.round(lowest * 1.25 / 100) * 100 : null,
      stockStatus: best === 0 ? 'sold_out' : best <= 3 ? 'low_stock' : 'in_stock', salesCount: sales, featuredRank: draw() < 0.02 ? 3 : 0,
      publishedAt: status === 'active' ? new Date(at.getTime() - daysAgo * 86_400_000) : null, version: 1, createdAt: at, updatedAt: at,
    })
    categoryRows.push({ productId, categoryId: category.id })
    for (const [sizeSystemValueId, inStock] of stocked) sizeRows.push({ productId, sizeSystemValueId, inStock })
    mediaRows.push({ productId, mediaId: /** @type {string} */ (pool[i % pool.length]), sortOrder: 0, role: 'model', alt: title, optionValueId: null }, { productId, mediaId: /** @type {string} */ (pool[(i + 5) % pool.length]), sortOrder: 1, role: 'detail', alt: `${title}, detail`, optionValueId: null })
    for (const a of [fabric, occasion, piece]) if (a?.values.length) attrValueRows.push({ productId, attributeId: a.attributeId, valueId: /** @type {string} */ (pick(a.values).id), valueNumber: null })
  }

  // parents before children
  await inChunks((r) => db.insert(products).values(r), productRows)
  await inChunks((r) => db.insert(productCategories).values(r), categoryRows)
  await inChunks((r) => db.insert(productMedia).values(r), mediaRows)
  await inChunks((r) => db.insert(productOptions).values(r), optionRows)
  await inChunks((r) => db.insert(productOptionValues).values(r), valueRows2)
  await inChunks((r) => db.insert(variants).values(r), variantRows)
  await inChunks((r) => db.insert(variantOptionValues).values(r), linkRows)
  await inChunks((r) => db.insert(inventoryLevels).values(r), levelRows)
  await inChunks((r) => db.insert(inventoryMovements).values(r), movementRows)
  await inChunks((r) => db.insert(productAttributeValues).values(r), attrValueRows)
  await inChunks((r) => db.insert(productSizes).values(r), sizeRows)
  log(`  inserted ${productRows.length} products, ${variantRows.length} variants`)

  let indexed = 0
  if (search && productRows.length) indexed = await search.reindexAll()
  return { products: productRows.length, variants: variantRows.length, indexed, seconds: Math.round((Date.now() - started) / 100) / 10 }
}

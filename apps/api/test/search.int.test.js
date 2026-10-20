// M1-11: the search text of products, the query builder, synonyms, the miss log, and the events that keep the index current.
import { and, eq, gte, lte } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { jobs, outboxEvents } from '../src/db/schema/platform.js'
import { media } from '../src/db/schema/media.js'
import { products } from '../src/db/schema/products.js'
import { productSearch, searchMisses, searchSynonyms } from '../src/db/schema/search.js'
import { attributes, categories } from '../src/db/schema/taxonomy.js'
import { advanceClock, setClock } from '../src/platform/clock.js'
import { uuidv7 } from '../src/platform/ids.js'
import { relayOnce } from '../src/platform/outbox.js'
import { createCatalogService } from '../src/modules/catalog/index.js'
import { eventHandlers } from '../src/modules/index.js'
import { normalise, toExpression } from '../src/modules/search/query.js'
import { createSearch, searchJobs } from '../src/modules/search/index.js'
import { synonymSeeds } from '../src/modules/search/synonyms.js'
import { closeHarness, config, createHarness, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const REQ = { ip: '10.0.0.1', userAgent: 'vitest', requestId: '0190f2c0-0000-7000-8000-000000000001' }
const ACTOR = { staffId: '0190f2c0-0000-7000-8000-0000000000aa', name: 'Tester', role: 'owner', canPublish: true }
const pkr = (/** @type {number} */ rupees) => ({ amount: rupees * 100, currency: 'PKR' })

/** @type {ReturnType<typeof createSearch>} */
let search
/** @type {ReturnType<typeof createCatalogService>} */
let catalog
let pic = ''
let women = ''
let lawn = ''
let sku = 0

/** An active product, indexed. Unknown keys of `extra` override the defaults. */
async function product(/** @type {string} */ title, /** @type {Record<string, any>} */ extra = {}) {
  const body = {
    handle: `h-${uuidv7().slice(-10)}`, status: 'active', kind: 'accessory', title, primaryCategoryId: lawn, categoryIds: [], attributes: [], options: [],
    media: [{ mediaId: pic, alt: 'x' }],
    variants: [{ key: 'v', sku: extra.sku ?? `SKU-${++sku}`, optionValueKeys: [], price: pkr(1000), stockMode: 'made_to_order', maxPerOrder: 5, enabled: true }],
    ...extra,
  }
  delete (/** @type {any} */ (body)).sku
  const made = await catalog.products.save(ACTOR, null, /** @type {never} */ (body), REQ)
  await search.reindexProduct(made.id)
  return made
}
const ids = async (/** @type {string} */ q, /** @type {object} */ opts = {}) => (await search.run({ q, ...opts })).map((r) => r.id)
const rowOf = async (/** @type {string} */ id) => (await t.db.select().from(productSearch).where(eq(productSearch.productId, id)))[0]

describe('the query builder', () => {
  it('keeps letters, digits and spaces, and nothing that is boolean-mode syntax', () => {
    expect(normalise('  Shalwaar   KAM  ')).toBe('shalwaar kam')
    expect(normalise('+++"')).toBe('')
    expect(normalise('*')).toBe('')
    expect(normalise('-(a) ~b <c> @d "e" +f')).toBe('a b c d e f')
    expect(normalise("' OR 1=1 --")).toBe('or 1 1')
    expect(normalise('wide-leg trouser')).toBe('wide leg trouser')
    expect(normalise('لان سوٹ')).toBe('لان سوٹ')
    expect(normalise('x'.repeat(200))).toHaveLength(80)
    expect(normalise('a b c d e f g h i j k')).toBe('a b c d e f g h')
  })

  it('requires every word, offers spellings as alternatives, and lets the last word be a prefix', () => {
    const syn = new Map([['shalwaar', ['shalwar', 'salwar']], ['shalwar', ['shalwaar']]])
    expect(toExpression('shalwaar kam', syn)).toBe('+(shalwaar shalwar salwar) +(kam*)')
    expect(toExpression('kam shalwaar', syn)).toBe('+(kam) +(shalwaar* shalwar* salwar*)')
    expect(toExpression('lawn', new Map())).toBe('+(lawn*)')
    expect(toExpression('a lawn x', new Map())).toBe('+(lawn*)') // one-letter words are not in the index
    expect(toExpression('', syn)).toBe('')
    expect(toExpression('a', syn)).toBe('')
  })

  it('has seed spellings that find each other in both directions', () => {
    const by = new Map(synonymSeeds.map((s) => [s.term, s.expandsTo.split(' ')]))
    expect(by.get('shalwaar')).toContain('shalwar')
    expect(by.get('shalwar')).toContain('shalwaar')
    for (const [term, others] of by) for (const o of others) expect(by.get(o), `${o} should lead back to ${term}`).toContain(term)
  })
})

describe.skipIf(!dbAvailable)('search (MySQL FULLTEXT)', () => {
  beforeAll(async () => {
    await createHarness()
    search = createSearch({ db: t.db })
    catalog = createCatalogService({ db: t.db, config, media: { imagesFor: async () => ({}) } })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    search.forgetSynonyms()
    await t.migrate.db.delete(auditLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(jobs)
    await t.db.delete(searchMisses)
    await t.db.delete(searchSynonyms)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    await t.db.delete(products)
    await t.db.delete(media)
    for (let i = 0; i < 4; i++) await t.migrate.pool.query('DELETE c FROM categories c LEFT JOIN categories k ON k.parent_id = c.id WHERE k.id IS NULL')
    await t.db.delete(attributes)
    await t.db.delete(staffUsers)
  })
  // every test starts with a small category tree and a ready picture
  const fresh = async () => {
    women = uuidv7()
    lawn = uuidv7()
    pic = uuidv7()
    await t.db.insert(categories).values({ id: women, handle: `w-${women.slice(-6)}`, name: 'Women', createdAt: new Date(), updatedAt: new Date() })
    await t.db.insert(categories).values({ id: lawn, parentId: women, handle: `l-${lawn.slice(-6)}`, name: 'Lawn collection', createdAt: new Date(), updatedAt: new Date() })
    await t.db.insert(media).values({ id: pic, kind: 'image', status: 'ready', objectKey: `media/2026/10/${pic}.jpg`, contentType: 'image/jpeg', bytes: 1, width: 1000, height: 1000, alt: 'x', createdAt: new Date() })
    await search.seedSynonyms()
  }

  describe('what is searchable', () => {
    it('indexes title, subtitle, brand and colourway as the title, and the rest as the body', async () => {
      await fresh()
      const fabric = (await catalog.attributes.create({ staffId: ACTOR.staffId, name: 'x', role: 'owner' }, { code: 'fabric', label: 'Fabric', type: 'enum', display: 'checkbox', filterable: true, values: [{ code: 'jacquard', label: 'Jacquard' }] }, REQ))
      const description = `Soft cotton blend. ${'filler '.repeat(100)}hiddenword`
      const p = await product('Zarqa suit', {
        subtitle: 'Festive edit', brand: 'Rubaya', colorway: { label: 'Emerald', family: 'green', swatch: { hex: ['#006400'] } }, styleId: 'zarqa',
        attributes: [{ attributeId: fabric.id, valueIds: [fabric.values[0]?.id] }], components: [{ type: 'shirt', label: 'Shirt', fabric: 'Organza', technique: 'Zardozi', included: true }],
        descriptionMd: description, sku: 'ZQ-001', i18n: { ur: { title: 'زرقا جوڑا' } },
      })
      const row = await rowOf(p.id)
      expect(row?.titleText).toBe('Zarqa suit Festive edit Rubaya Emerald')
      for (const word of ['Women', 'Lawn collection', 'Jacquard', 'Organza', 'Zardozi', 'ZQ-001', 'Soft cotton blend', 'زرقا جوڑا']) expect(row?.bodyText, word).toContain(word)
      expect(row?.bodyText).not.toContain('hiddenword') // only the first 500 characters of the description
      expect(await ids('emerald')).toEqual([p.id])
      expect(await ids('rubaya')).toEqual([p.id])
      expect(await ids('jacquard')).toEqual([p.id])
      expect(await ids('zardozi')).toEqual([p.id])
      expect(await ids('hiddenword')).toEqual([])
      expect(await ids('زرقا')).toEqual([p.id])
    }, 60_000)

    it('finds a product by its category and by the categories above it', async () => {
      await fresh()
      const p = await product('Plain kameez')
      expect(await ids('lawn collection')).toEqual([p.id])
      expect(await ids('women')).toEqual([p.id])
    }, 60_000)

    it('matches two-letter words, short phrases and the small words inside names', async () => {
      await fresh()
      const xl = await product('Cotton tee XL fit')
      const pc = await product('3 pc stitched suit')
      const eid = await product('Dress for Eid in Silk')
      expect(await ids('xl')).toEqual([xl.id])
      expect(await ids('3 pc')).toEqual([pc.id])
      expect(await ids('for')).toEqual([eid.id])
      expect(await ids('in silk')).toEqual([eid.id])
    }, 60_000)

    it('treats spellings alike: shalwar and shalwaar give the same products', async () => {
      await fresh()
      const a = await product('Cotton shalwar')
      const b = await product('Silk shalwaar')
      const c = await product('Dupata set')
      const sorted = async (/** @type {string} */ q) => (await ids(q)).sort()
      expect(await sorted('shalwar')).toEqual([a.id, b.id].sort())
      expect(await sorted('shalwaar')).toEqual([a.id, b.id].sort())
      expect(await sorted('salwar')).toEqual([a.id, b.id].sort())
      expect(await ids('dupatta')).toEqual([c.id])
    }, 60_000)

    it('requires every word, and lets only the last one be a prefix', async () => {
      await fresh()
      const suit = await product('Lawn suit')
      await product('Lawn dress')
      expect(await ids('lawn su')).toEqual([suit.id])
      expect(await ids('law suit'), 'a prefix in the middle does not match').toEqual([])
      expect(await ids('lawn suit silk')).toEqual([])
      expect((await ids('lawn')).length).toBe(2)
    }, 60_000)
  })

  describe('ordering and exact SKUs', () => {
    it('puts title matches above matches elsewhere, then the better seller', async () => {
      await fresh()
      const inBody = await product('Plain kameez', { descriptionMd: 'Embroidered neckline' })
      const inTitle = await product('Embroidered kameez')
      const seller = await product('Embroidered kurta')
      await t.db.update(products).set({ salesCount: 40 }).where(eq(products.id, seller.id))
      const r = await search.run({ q: 'embroidered' })
      expect(r.map((x) => x.id)).toEqual([seller.id, inTitle.id, inBody.id])
      expect(/** @type {number} */ (r[1]?.score)).toBeGreaterThan(/** @type {number} */ (r[2]?.score))
    }, 60_000)

    it('an exact SKU, in any case, comes first', async () => {
      await fresh()
      const text = await product('Lawn suit ab123 edition')
      const exact = await product('Something else entirely', { sku: 'AB-123' })
      expect((await ids('ab-123'))[0]).toBe(exact.id)
      expect((await search.run({ q: 'AB-123' }))[0]).toMatchObject({ id: exact.id })
      expect(await ids('lawn ab123')).toEqual([text.id])
    }, 60_000)
  })

  describe('queries that are not words', () => {
    it('answer with nothing, never an SQL error', async () => {
      await fresh()
      await product('Lawn suit')
      for (const q of ['+++"', '*', '-', '()~<>@', '"', '+', '--', "' OR 1=1 --", '"lawn" +(', '@@version', ' ', '', 'a', '%', '\\', ';DROP TABLE products;']) {
        await expect(search.run({ q }), JSON.stringify(q)).resolves.toBeInstanceOf(Array)
      }
      expect(await ids('+++"')).toEqual([])
      expect(await ids('*')).toEqual([])
      expect(await ids('"lawn" +(suit)~')).toHaveLength(1)
    }, 60_000)

    it('stay under the length limits', async () => {
      await fresh()
      const p = await product('Lawn suit')
      expect(await ids(`lawn suit ${'lawn '.repeat(6)}zzzz`), 'the ninth word is not read').toEqual([p.id])
      expect(await ids(`lawn suit ${'lawn '.repeat(5)}zzzz`), 'the eighth is').toEqual([])
      expect(await ids(`lawn ${' '.repeat(500)} suit`)).toEqual([p.id])
    }, 60_000)
  })

  describe('only what is live', () => {
    it('a draft or archived product is not found, and archiving removes it on the next reindex', async () => {
      await fresh()
      const live = await product('Lawn suit live')
      const draft = await product('Lawn suit draft', { status: 'draft' })
      await product('Lawn suit sleeper')
      expect(await rowOf(draft.id)).toBeUndefined()
      expect((await ids('lawn suit')).length).toBe(2)
      await t.db.update(products).set({ status: 'archived' }).where(eq(products.id, live.id))
      expect(await ids('lawn suit live'), 'the row is still there, but the query checks the product').toEqual([])
      await search.reindexProduct(live.id)
      expect(await rowOf(live.id)).toBeUndefined()
    }, 60_000)

    it('reindexAll rebuilds every active product and clears rows of the others', async () => {
      await fresh()
      const a = await product('Alpha lawn')
      const b = await product('Beta lawn')
      await t.db.update(products).set({ title: 'Gamma lawn' }).where(eq(products.id, a.id))
      await t.db.update(products).set({ status: 'draft' }).where(eq(products.id, b.id))
      expect(await search.reindexAll()).toBe(1)
      expect((await rowOf(a.id))?.titleText).toBe('Gamma lawn')
      expect(await rowOf(b.id)).toBeUndefined()
    }, 60_000)

    it('takes the predicates of a listing, so filters and text search are one query', async () => {
      await fresh()
      const cheap = await product('Lawn cheap', { variants: [{ key: 'v', sku: 'C-1', optionValueKeys: [], price: pkr(1000), stockMode: 'made_to_order', maxPerOrder: 5, enabled: true }] })
      const dear = await product('Lawn dear', { variants: [{ key: 'v', sku: 'D-1', optionValueKeys: [], price: pkr(9000), stockMode: 'made_to_order', maxPerOrder: 5, enabled: true }] })
      expect(await ids('lawn', { where: gte(products.priceMinMinor, 500_000) })).toEqual([dear.id])
      expect(await ids('lawn', { where: and(lte(products.priceMinMinor, 500_000), eq(products.stockStatus, 'made_to_order')) })).toEqual([cheap.id])
      expect(await ids('lawn', { limit: 1, offset: 1 })).toHaveLength(1)
    }, 60_000)
  })

  describe('the index is used', () => {
    it('EXPLAIN shows the FULLTEXT index', async () => {
      await fresh()
      await product('Lawn suit')
      const [plan] = /** @type {any[][]} */ (await t.migrate.pool.query("EXPLAIN SELECT product_id FROM product_search WHERE MATCH(title_text, body_text) AGAINST ('+(lawn*)' IN BOOLEAN MODE)"))
      expect(plan?.[0]).toMatchObject({ type: 'fulltext', key: 'product_search_all_ft' })
    }, 60_000)
  })

  describe('the miss log', () => {
    it('counts queries that found nothing per day, normalised, and ignores phone-like text', async () => {
      await fresh()
      setClock(new Date('2026-10-10T20:00:00.000Z')) // 01:00 on the 11th in Karachi
      await product('Lawn suit')
      await ids('Chikankari  Kurta')
      await ids('chikankari kurta')
      await ids('0300 1234567')
      await ids('lawn') // a hit
      await ids('+++')
      await ids('zzzz', { logMiss: false })
      const rows = await t.db.select().from(searchMisses)
      expect(rows).toEqual([{ day: '2026-10-11', query: 'chikankari kurta', count: 2 }])
      advanceClock(26 * 3_600_000)
      await ids('chikankari kurta')
      await ids('abaya black')
      expect(await search.topMisses({ days: 7 })).toEqual([{ query: 'chikankari kurta', count: 3 }, { query: 'abaya black', count: 1 }])
      expect(await search.topMisses({ days: 7, limit: 1 })).toHaveLength(1)
    }, 60_000)

    it('keeps 180 days', async () => {
      await fresh()
      setClock(new Date('2026-10-10T10:00:00.000Z'))
      await t.db.insert(searchMisses).values([{ day: '2026-04-10', query: 'old', count: 1 }, { day: '2026-04-15', query: 'recent', count: 1 }])
      await search.cleanupMisses()
      expect((await t.db.select().from(searchMisses)).map((r) => r.query)).toEqual(['recent'])
    }, 60_000)
  })

  describe('synonyms are cached for five minutes', () => {
    it('a new spelling is used after the cache expires', async () => {
      await fresh()
      setClock(new Date('2026-10-10T10:00:00.000Z'))
      const p = await product('Kurta set')
      expect(await ids('kurtay')).toEqual([])
      await t.db.insert(searchSynonyms).values({ term: 'kurtay', expandsTo: 'kurta', createdAt: new Date() })
      expect(await ids('kurtay'), 'still the cached list').toEqual([])
      advanceClock(6 * 60_000)
      expect(await ids('kurtay')).toEqual([p.id])
    }, 60_000)

    it('seeding is idempotent', async () => {
      await fresh()
      expect(await search.seedSynonyms()).toBe(0)
      expect((await t.db.select().from(searchSynonyms)).length).toBe(synonymSeeds.length)
    }, 60_000)
  })

  describe('events keep the index current', () => {
    it('saving a product starts a reindex job that fills its row; renaming a category starts a full rebuild', async () => {
      await fresh()
      const made = await catalog.products.save(ACTOR, null, /** @type {never} */ ({
        handle: 'event-suit', status: 'active', kind: 'accessory', title: 'Event suit', primaryCategoryId: lawn, categoryIds: [], attributes: [], options: [], media: [{ mediaId: pic, alt: 'x' }],
        variants: [{ key: 'v', sku: 'EV-1', optionValueKeys: [], price: pkr(1000), stockMode: 'made_to_order', maxPerOrder: 5, enabled: true }],
      }), REQ)
      expect(await rowOf(made.id), 'nothing is indexed until the job runs').toBeUndefined()
      expect(await relayOnce(t.db, eventHandlers)).toBeGreaterThan(0)
      const queued = (await t.db.select().from(jobs)).filter((j) => j.type === 'search.reindex_product')
      expect(queued).toHaveLength(1)
      const handlers = searchJobs(search)
      await handlers['search.reindex_product']?.({ job: { id: 'j', type: 'search.reindex_product', payload: queued[0]?.payload, attempts: 0, maxAttempts: 8 }, signal: new AbortController().signal })
      expect((await rowOf(made.id))?.titleText).toBe('Event suit')

      await t.db.delete(jobs)
      const cat = (await catalog.categories.list()).items.find((c) => c.id === lawn)
      await catalog.categories.update({ staffId: ACTOR.staffId, name: 'x', role: 'owner' }, lawn, { name: 'Summer lawn', handle: cat?.handle ?? '', parentId: women, visible: true, attributes: [], version: cat?.version ?? 1 }, REQ)
      await relayOnce(t.db, eventHandlers)
      expect((await t.db.select().from(jobs)).map((j) => j.type)).toContain('search.reindex_all')
      await handlers['search.reindex_all']?.({ job: { id: 'j', type: 'search.reindex_all', payload: {}, attempts: 0, maxAttempts: 8 }, signal: new AbortController().signal })
      expect((await rowOf(made.id))?.bodyText).toContain('Summer lawn')
    }, 60_000)
  })

  describe('the index repairs itself (a worker that was off, a crash between a change and its job)', () => {
    /** An active product that is NOT indexed: what a save leaves behind until its job has run. */
    const unindexed = async (/** @type {string} */ title) =>
      catalog.products.save(ACTOR, null, /** @type {never} */ ({
        handle: `u-${uuidv7().slice(-10)}`, status: 'active', kind: 'accessory', title, primaryCategoryId: lawn, categoryIds: [], attributes: [], options: [], media: [{ mediaId: pic, alt: 'x' }],
        variants: [{ key: 'v', sku: `UN-${++sku}`, optionValueKeys: [], price: pkr(1000), stockMode: 'made_to_order', maxPerOrder: 5, enabled: true }],
      }), REQ)

    it('counts what is missing, out of date and left over; reconcile puts it right, then finds nothing to do', async () => {
      await fresh()
      const kept = await product('Repair alpha')
      const gone = await product('Repair gamma')
      await unindexed('Repair beta')
      await t.db.update(productSearch).set({ updatedAt: new Date(Date.now() - 3_600_000) }).where(eq(productSearch.productId, kept.id)) // the product changed after its row was written
      await t.db.update(products).set({ status: 'archived' }).where(eq(products.id, gone.id)) // no longer sold, row still there
      expect(await search.health()).toMatchObject({ active: 2, indexed: 2, missing: 1, stale: 1, orphaned: 1, rebuildQueued: false })
      expect(await search.reconcile()).toEqual({ reindexed: 2, removed: 1, remaining: 0 })
      expect(await search.health()).toMatchObject({ active: 2, indexed: 2, missing: 0, stale: 0, orphaned: 0 })
      expect(await search.reconcile(), 'a healthy index costs a few counts and no work').toEqual({ reindexed: 0, removed: 0, remaining: 0 })
      expect(await rowOf(gone.id)).toBeUndefined()
    }, 60_000)

    it('does a batch at a time and says how much is left', async () => {
      await fresh()
      for (let i = 0; i < 5; i++) await unindexed(`Batch item ${i}`)
      expect(await search.reconcile({ limit: 3 })).toEqual({ reindexed: 3, removed: 0, remaining: 2 })
      expect(await search.reconcile({ limit: 3 })).toEqual({ reindexed: 2, removed: 0, remaining: 0 })
    }, 60_000)

    it('a product the index does not hold yet is still found by the start of its name', async () => {
      await fresh()
      const made = await unindexed('Zebra unindexed kurta')
      expect(await rowOf(made.id)).toBeUndefined()
      const p = await search.predicate('Zebra unin')
      if (p.empty) throw new Error('the text has words')
      expect((await t.db.select({ id: products.id }).from(products).where(p.where)).map((r) => r.id)).toEqual([made.id])
    }, 60_000)

    it('a rebuild asked for in the admin queues one full reindex a minute and is written to the audit log', async () => {
      await fresh()
      const actor = { staffId: ACTOR.staffId, name: 'Tester', role: 'owner' }
      await t.db.insert(staffUsers).values({ id: ACTOR.staffId, email: 'search-rebuild@example.com', name: 'Tester', role: 'owner', status: 'active', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date(), lastSeenAt: new Date(), version: 1, createdBy: null }).onDuplicateKeyUpdate({ set: { name: 'Tester' } })
      expect(await search.requestRebuild(actor, REQ)).toEqual({ queued: true })
      await search.requestRebuild(actor, REQ)
      expect((await t.db.select().from(jobs)).filter((j) => j.type === 'search.reindex_all')).toHaveLength(1)
      expect((await search.health()).rebuildQueued).toBe(true)
      expect((await t.migrate.db.select().from(auditLog)).map((a) => a.action)).toContain('search.rebuild_requested')
    }, 60_000)
  })
})

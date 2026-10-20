// Visits and the colours of Customers (plan/17-owner-requests-2026-10.md section 6): a browser is counted without a name, belongs to a customer only after it
// placed an order, and the rules that colour customers are rows staff edit. On a scratch database.
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { customers } from '../src/db/schema/customers.js'
import { customerHighlightRules, visitors, visits } from '../src/db/schema/visits.js'
import { createCustomersService } from '../src/modules/customers/index.js'
import { highlightsFor } from '../src/modules/customers/highlights.js'
import { cleanPath, createVisitsService, VISIT_GAP_MS } from '../src/modules/visits/index.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { seedBase } from '../src/seed/base.js'
import { closeHarness, createHarness, signedIn, t } from './support/staff.js'
import { dbAvailable } from './support/db.js'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)
const start = new Date('2026-10-19T08:00:00.000Z')

describe('which rule colours a customer (no database)', () => {
  /** @type {import('../src/modules/customers/highlights.js').Rule[]} */
  const rules = [
    { id: 'r3', kind: 'orders', minCount: 11, maxCount: null, color: '#16a34a', label: 'Loyal', enabled: true },
    { id: 'r1', kind: 'orders', minCount: 1, maxCount: 5, color: '#3b82f6', label: 'New', enabled: true },
    { id: 'r2', kind: 'orders', minCount: 6, maxCount: 10, color: '#f59e0b', label: 'Regular', enabled: true },
    { id: 'v1', kind: 'visits', minCount: 2, maxCount: null, color: '#8b5cf6', label: 'Repeat visitor', enabled: true },
  ]
  const labels = (/** @type {number} */ ordersCount, /** @type {number} */ visitsCount, r = rules) => highlightsFor(r, { ordersCount, visitsCount }).map((h) => h.label)

  it('takes the range the count is in, by orders and by visits separately', () => {
    expect(labels(0, 0)).toEqual([])
    expect(labels(1, 1)).toEqual(['New'])
    expect(labels(5, 2)).toEqual(['New', 'Repeat visitor'])
    expect(labels(6, 0)).toEqual(['Regular'])
    expect(labels(10, 0)).toEqual(['Regular'])
    expect(labels(11, 0)).toEqual(['Loyal'])
    expect(labels(500, 0)).toEqual(['Loyal'])
  })

  it('ignores a rule that is switched off, and lets the lower range win when two overlap', () => {
    expect(labels(3, 0, rules.map((r) => (r.id === 'r1' ? { ...r, enabled: false } : r)))).toEqual([])
    expect(labels(3, 0, [...rules, { id: 'x', kind: 'orders', minCount: 2, maxCount: 4, color: '#000000', label: 'Overlap', enabled: true }])).toEqual(['New'])
  })
})

describe('what a visit is', () => {
  it('keeps only the address of the page', () => {
    expect(cleanPath('/search?q=lawn#top')).toBe('/search')
    expect(cleanPath('p/lawn-kurta')).toBe('/p/lawn-kurta')
    expect(cleanPath('/' + 'x'.repeat(300))).toHaveLength(120)
  })
})

describe.skipIf(!dbAvailable)('visits and highlight rules (MySQL)', () => {
  /** @type {ReturnType<typeof createCustomersService>} */
  let customersService
  /** @type {ReturnType<typeof createVisitsService>} */
  let service
  let tracking = true
  const orderOf = new Map([['token-of-sana', ''], ['token-of-hina', '']])

  beforeAll(async () => {
    await createHarness()
    customersService = createCustomersService({ db: t.db })
    service = createVisitsService({
      db: t.db,
      customers: customersService,
      orders: { orderByToken: async (token) => ({ customerId: orderOf.get(token) ?? '' }) },
      enabled: async () => tracking,
    })
  }, 60_000)
  afterAll(() => {
    setClock(null)
    return closeHarness()
  })
  afterEach(async () => {
    setClock(null)
    tracking = true
    await t.migrate.db.delete(auditLog)
    await t.db.delete(visitors) // visits go with them
    await t.db.delete(customers)
    await t.db.delete(customerHighlightRules)
    await t.db.delete(staffUsers)
  })

  const customer = async (/** @type {string} */ phone, /** @type {string} */ name) => transaction(t.db, (tx) => customersService.upsertByPhone(tx, { phone, name }))
  const at = (/** @type {number} */ minutes) => setClock(new Date(start.getTime() + minutes * 60_000))

  describe('counting', () => {
    it('counts a stay as one visit however many pages it opens, and a return after 30 minutes as another', async () => {
      at(0)
      await service.record({ visitor: A, path: '/' })
      at(10)
      await service.record({ visitor: A, path: '/c/women' })
      at(29)
      await service.record({ visitor: A, path: '/p/lawn' })
      expect((await t.db.select().from(visitors).where(eq(visitors.id, A)))[0]?.visitsCount).toBe(1)
      // the gap is measured from the last page, so the stay above is still going 30 minutes after its start
      at(29 + VISIT_GAP_MS / 60_000 + 1)
      await service.record({ visitor: A, path: '/cart?x=1' })
      const row = (await t.db.select().from(visitors).where(eq(visitors.id, A)))[0]
      expect(row?.visitsCount).toBe(2)
      const rows = await t.db.select().from(visits).where(eq(visits.visitorId, A))
      expect(rows.map((v) => v.landingPath).sort()).toEqual(['/', '/cart'])
    })

    it('counts the same browser once even when its first pages arrive together', async () => {
      at(0)
      await Promise.all(Array.from({ length: 5 }, () => service.record({ visitor: B, path: '/' })))
      expect((await t.db.select().from(visitors).where(eq(visitors.id, B)))[0]?.visitsCount).toBe(1)
      expect(await t.db.select().from(visits).where(eq(visits.visitorId, B))).toHaveLength(1)
    })

    it('counts nothing while the store setting is off', async () => {
      tracking = false
      at(0)
      await service.record({ visitor: A, path: '/' })
      expect(await t.db.select().from(visitors)).toHaveLength(0)
    })
  })

  describe('belonging to a customer', () => {
    it('gives a browser to the customer who ordered from it, with the visits it already had and the ones to come', async () => {
      const sana = await customer('0300 1111111', 'Sana')
      orderOf.set('token-of-sana', sana.id)
      at(0)
      await service.record({ visitor: A, path: '/' })
      at(120)
      await service.record({ visitor: A, path: '/' })
      expect((await t.db.select().from(customers).where(eq(customers.id, sana.id)))[0]?.visitsCount).toBe(0) // anonymous until an order
      await service.link({ visitor: A, order: 'token-of-sana' })
      expect((await t.db.select().from(customers).where(eq(customers.id, sana.id)))[0]).toMatchObject({ visitsCount: 2 })
      at(300)
      await service.record({ visitor: A, path: '/orders' })
      expect((await t.db.select().from(customers).where(eq(customers.id, sana.id)))[0]?.visitsCount).toBe(3)
    })

    it('keeps a browser with the first customer who ordered from it, and ignores an order link it never saw', async () => {
      const sana = await customer('0300 1111111', 'Sana')
      const hina = await customer('0300 2222222', 'Hina')
      orderOf.set('token-of-sana', sana.id)
      orderOf.set('token-of-hina', hina.id)
      at(0)
      await service.record({ visitor: A, path: '/' })
      await service.link({ visitor: A, order: 'token-of-sana' })
      await service.link({ visitor: A, order: 'token-of-hina' })
      await service.link({ visitor: B, order: 'token-of-hina' }) // a browser that was never counted: nothing to give
      const rows = await t.db.select().from(customers)
      expect(Object.fromEntries(rows.map((c) => [c.name, c.visitsCount]))).toEqual({ Sana: 1, Hina: 0 })
    })

    it('forgets the browsers of a customer who is anonymised', async () => {
      const sana = await customer('0300 1111111', 'Sana')
      orderOf.set('token-of-sana', sana.id)
      at(0)
      await service.record({ visitor: A, path: '/' })
      await service.link({ visitor: A, order: 'token-of-sana' })
      const { b } = await signedIn('owner')
      const done = await b.call('POST', `/admin/customers/${sana.id}/anonymise`, { body: { confirm: '1111' } })
      expect(done.status, JSON.stringify(done.body)).toBe(204)
      expect(await t.db.select().from(visitors)).toHaveLength(0)
      expect(await t.db.select().from(visits)).toHaveLength(0)
      expect((await t.db.select().from(customers))[0]).toMatchObject({ visitsCount: 0, lastVisitAt: null })
    })
  })

  describe('the anonymous figures', () => {
    it('counts visits, visitors, new and returning visitors and visitors who are customers by Pakistan day', async () => {
      const sana = await customer('0300 1111111', 'Sana')
      orderOf.set('token-of-sana', sana.id)
      setClock(new Date('2026-10-17T10:00:00.000Z')) // before the period
      await service.record({ visitor: A, path: '/' })
      setClock(new Date('2026-10-18T10:00:00.000Z'))
      await service.record({ visitor: A, path: '/' }) // A comes back in the period
      await service.record({ visitor: B, path: '/' }) // B is new
      setClock(new Date('2026-10-18T20:30:00.000Z')) // 01:30 on the 19th in Pakistan: the next day
      await service.record({ visitor: B, path: '/' })
      await service.link({ visitor: A, order: 'token-of-sana' })
      const s = await service.summary('2026-10-18', '2026-10-19')
      expect(s).toMatchObject({ visits: 3, visitors: 2, newVisitors: 1, returningVisitors: 1, identifiedVisitors: 1 })
      expect(s.days).toEqual([
        { day: '2026-10-18', visits: 2, visitors: 2 },
        { day: '2026-10-19', visits: 1, visitors: 1 },
      ])
    })

    it('refuses a backwards or a too long period', async () => {
      await expect(service.summary('2026-10-19', '2026-10-18')).rejects.toMatchObject({ code: 'validation_failed' })
      await expect(service.summary('2025-01-01', '2026-10-18')).rejects.toMatchObject({ code: 'validation_failed' })
    })
  })

  describe('through HTTP', () => {
    it('takes a visit from the shop without a login and refuses a visitor id that is not 32 hex characters', async () => {
      const { b } = await signedIn('owner') // only to get a client: the two routes below need no cookie
      const ok = await b.call('POST', '/visits', { body: { visitor: A, path: '/p/lawn-kurta' }, origin: null, csrf: false })
      expect(ok.status, JSON.stringify(ok.body)).toBe(204)
      expect((await b.call('POST', '/visits', { body: { visitor: 'nope', path: '/' }, origin: null, csrf: false })).status).toBe(400)
      expect(await t.db.select().from(visitors)).toHaveLength(1)
    })

    it('lists, saves and colours: a rule is added, changed and removed by staff, and a customer list shows the colour and filters by it', async () => {
      const { b } = await signedIn('owner')
      expect((await b.call('GET', '/admin/customers/highlight-rules')).body.items).toEqual([])
      const saved = await b.call('PUT', '/admin/customers/highlight-rules', {
        body: { rules: [{ kind: 'orders', minCount: 1, maxCount: 5, color: '#3B82F6', label: 'New', enabled: true }, { kind: 'visits', minCount: 3, color: '#8b5cf6', label: 'Often here', enabled: true }] },
      })
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      const [first, second] = saved.body.items
      expect(first).toMatchObject({ color: '#3b82f6', maxCount: 5 })
      expect(second).not.toHaveProperty('maxCount')

      const sana = await customer('0300 1111111', 'Sana')
      await transaction(t.db, (tx) => customersService.applyOrderChange(tx, sana.id, { orders: 2, orderedAt: start }))
      const list = (await b.call('GET', '/admin/customers')).body.items
      expect(list[0].highlights).toEqual([{ ruleId: first.id, kind: 'orders', label: 'New', color: '#3b82f6' }])
      expect((await b.call('GET', `/admin/customers?rule=${first.id}`)).body.items).toHaveLength(1)
      expect((await b.call('GET', `/admin/customers?rule=${second.id}`)).body.items).toHaveLength(0)

      // change the first, drop the second, add a third: the first keeps its id
      const next = await b.call('PUT', '/admin/customers/highlight-rules', {
        body: { rules: [{ id: first.id, kind: 'orders', minCount: 3, maxCount: 9, color: '#ff0000', label: 'Changed', enabled: true }, { kind: 'orders', minCount: 10, color: '#00ff00', label: 'Big', enabled: false }] },
      })
      expect(next.body.items.map((/** @type {{ label: string, id: string }} */ r) => [r.label, r.id === first.id])).toEqual([['Changed', true], ['Big', false]])
      expect((await b.call('GET', '/admin/customers')).body.items[0].highlights).toEqual([]) // 2 orders: below 3, and "Big" is off
      expect((await b.call('GET', `/admin/customers?rule=${first.id}`)).body.items).toHaveLength(0)
      expect((await b.call('GET', `/admin/customers/${sana.id}`)).body).toMatchObject({ devices: 0, recentVisits: [], visitsCount: 0 })
    })

    it('refuses a colour that is not #rrggbb, a range that ends before it begins, an unknown id and too many rules', async () => {
      const { b } = await signedIn('owner')
      const rule = { kind: 'orders', minCount: 1, color: '#3b82f6', label: 'x', enabled: true }
      const save = (/** @type {unknown[]} */ rules) => b.call('PUT', '/admin/customers/highlight-rules', { body: { rules } })
      expect((await save([{ ...rule, color: 'blue' }])).status).toBe(400)
      expect((await save([{ ...rule, minCount: 5, maxCount: 2 }])).status).toBe(400)
      expect((await save([{ ...rule, id: '0194f1b2-7c3a-7000-8000-000000000001' }])).status).toBe(400)
      expect((await save(Array.from({ length: 31 }, () => rule))).status).toBe(400)
    })

    it('is for people who may read or write customers only', async () => {
      const { b } = await signedIn('catalog') // no customer permission
      expect((await b.call('GET', '/admin/customers/highlight-rules')).status).toBe(403)
      expect((await b.call('PUT', '/admin/customers/highlight-rules', { body: { rules: [] } })).status).toBe(403)
      expect((await b.call('GET', '/admin/customers/visit-summary?from=2026-10-01&to=2026-10-02')).status).toBe(403)
    })
  })

  describe('the first rules', () => {
    it('are added once to a shop that has none, and left alone after that', async () => {
      const search = { seedSynonyms: async () => 0 }
      await seedBase(t.migrate.db, { search })
      const rules = await t.db.select().from(customerHighlightRules)
      expect(rules.map((r) => [r.kind, r.minCount, r.maxCount]).sort()).toEqual([['orders', 1, 5], ['orders', 11, null], ['orders', 6, 10], ['visits', 2, null]].sort())
      await t.db.update(customerHighlightRules).set({ label: 'Edited by staff' }).where(eq(customerHighlightRules.minCount, 1))
      await seedBase(t.migrate.db, { search })
      expect((await t.db.select().from(customerHighlightRules)).some((r) => r.label === 'Edited by staff')).toBe(true)
      expect(await t.db.select().from(customerHighlightRules)).toHaveLength(4)
    })
  })
})

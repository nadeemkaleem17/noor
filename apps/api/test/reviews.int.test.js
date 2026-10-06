// M4-09: a customer reviews what was delivered, staff approve it, and the product's rating follows the approved reviews only. On a scratch database, through HTTP.
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { auditLog } from '../src/db/schema/audit.js'
import { staffUsers } from '../src/db/schema/auth.js'
import { carts } from '../src/db/schema/cart.js'
import { pages, settings } from '../src/db/schema/content.js'
import { customers } from '../src/db/schema/customers.js'
import { reservations } from '../src/db/schema/inventory.js'
import { media } from '../src/db/schema/media.js'
import { notificationLog } from '../src/db/schema/notifications.js'
import { orderLines, orders } from '../src/db/schema/orders.js'
import { paymentEvents, payments } from '../src/db/schema/payments.js'
import { counters, idempotencyKeys, jobs, outboxEvents, rateLimitHits } from '../src/db/schema/platform.js'
import { products } from '../src/db/schema/products.js'
import { promoRedemptions, promos } from '../src/db/schema/promotions.js'
import { reviewPhotos, reviews } from '../src/db/schema/reviews.js'
import { cities, couriers, shippingZones } from '../src/db/schema/shipping.js'
import { categories, formSchemas } from '../src/db/schema/taxonomy.js'
import { setClock } from '../src/platform/clock.js'
import { transaction } from '../src/platform/db.js'
import { uuidv7 } from '../src/platform/ids.js'
import { mediaJobs } from '../src/modules/media/index.js'
import { createServices } from '../src/modules/services.js'
import { app, closeHarness, config, createHarness, ORIGIN, t } from './support/staff.js'
import { add, createShop, shop } from './support/shop.js'
import { dbAvailable } from './support/db.js'

const S = createShop()
/** @type {ReturnType<typeof createServices>} */
let svc
/** @type {{ type: 'staff', id: string, label: string, role: 'owner' }} */
const staff = { type: 'staff', id: '', label: 'Hina Owner', role: 'owner' }
let tcs = ''
let seq = 0

const FORM = { rating: 5, body: 'Lovely fabric, the embroidery is neat and it fits well.', displayName: 'Sana M.' }
const go = (/** @type {string} */ id, /** @type {object} */ change) => transaction(t.db, (tx) => svc.orders.transition(tx, id, /** @type {never} */ (change), staff))

/** An order that went through to delivery: the link of it and the id of its one line. @param {{ variantId: string }} p */
async function delivered(p) {
  const phone = `0300${String(1000000 + ++seq).slice(-7)}`
  const cart = (await add(undefined, p.variantId, 1)).body.cartToken
  const r = await shop('POST', '/orders', {
    token: cart, headers: { 'idempotency-key': uuidv7() },
    body: { customer: { name: 'Sana Malik', phone }, shippingAddress: { cityId: S.cityId, address: 'House 12, Street 4, Gulberg III' }, shippingMethodId: S.methodId, paymentMethod: 'cod' },
  })
  if (r.status !== 201) throw new Error(JSON.stringify(r.body))
  const order = /** @type {typeof orders.$inferSelect} */ ((await t.db.select().from(orders)).find((o) => `${o.numberPrefix}-${o.number}` === r.body.orderNumber))
  const placed = { order, token: /** @type {string} */ (r.body.trackingToken), orderNumber: /** @type {string} */ (r.body.orderNumber) }
  const [line] = await t.db.select().from(orderLines).where(eq(orderLines.orderId, order.id))
  const lineId = /** @type {string} */ (line?.id)
  return {
    ...placed, lineId,
    async deliver() {
      await go(order.id, { version: 1, to: 'confirmed', via: 'call' })
      await go(order.id, { version: 2, to: 'dispatched', courierId: tcs })
      await go(order.id, { version: 3, to: 'delivered', cashReceived: true })
      return this
    },
  }
}
const invite = (/** @type {{ token: string, lineId: string }} */ o) => shop('GET', `/orders/by-token/${o.token}/lines/${o.lineId}/review`)
const submit = (/** @type {{ token: string, lineId: string }} */ o, /** @type {object} */ body = FORM) => shop('POST', `/orders/by-token/${o.token}/lines/${o.lineId}/review`, { body })
const listing = (/** @type {string} */ productId, /** @type {string} */ qs = '') => shop('GET', `/products/${productId}/reviews${qs}`)
const moderate = (/** @type {string} */ id, /** @type {object} */ body) => S.owner.call('POST', `/admin/reviews/${id}/moderation`, { body })
const reviewOf = async (/** @type {string} */ lineId) => /** @type {NonNullable<(typeof reviews.$inferSelect)>} */ ((await t.db.select().from(reviews).where(eq(reviews.orderLineId, lineId)))[0])
const ratingOf = async (/** @type {string} */ productId) => (await t.db.select({ avg: products.ratingAvgX100, n: products.ratingCount }).from(products).where(eq(products.id, productId)))[0]

describe.skipIf(!dbAvailable)('reviews (MySQL, through HTTP)', () => {
  beforeAll(async () => {
    await createHarness()
    svc = createServices({ db: t.db, config })
  }, 60_000)
  afterAll(closeHarness)
  afterEach(async () => {
    setClock(null)
    await t.migrate.db.delete(auditLog)
    await t.db.delete(reviewPhotos)
    await t.db.delete(reviews)
    await t.db.delete(notificationLog)
    await t.db.delete(outboxEvents)
    await t.db.delete(jobs)
    await t.db.delete(idempotencyKeys)
    await t.db.delete(rateLimitHits)
    await t.db.delete(paymentEvents)
    await t.db.delete(payments)
    await t.db.delete(reservations)
    await t.db.delete(orders)
    await t.db.delete(carts)
    await t.db.delete(promoRedemptions)
    await t.db.delete(promos)
    await t.db.delete(customers)
    await t.migrate.pool.query('DELETE FROM inventory_movements')
    await t.db.delete(products)
    await t.db.delete(media)
    await t.db.delete(formSchemas)
    await t.db.delete(shippingZones)
    await t.db.delete(cities)
    await t.db.delete(couriers)
    await t.db.delete(settings)
    await t.db.delete(pages)
    await t.db.delete(counters)
    await t.migrate.pool.query('DELETE FROM categories WHERE parent_id IS NOT NULL')
    await t.db.delete(categories)
    await t.db.delete(staffUsers)
  })
  const ready = async () => {
    await S.setup()
    staff.id = /** @type {{ id: string }} */ ((await t.db.select().from(staffUsers))[0]).id
    await S.delivery()
    tcs = (await S.owner.call('POST', '/admin/couriers', { body: { name: 'TCS', trackingRequired: false, enabled: true } })).body.id
  }

  describe('writing a review', () => {
    it('only for a delivered order: before that there is no invite and no review, and the order page offers none', async () => {
      await ready()
      const o = await (await delivered(await S.product({ price: 200000, stock: 5 })))
      expect((await invite(o)).status).toBe(404)
      expect(await submit(o)).toMatchObject({ status: 409, body: { code: 'action_not_allowed' } })
      expect((await shop('GET', `/orders/by-token/${o.token}`)).body.lines[0].review).toBeUndefined()
      expect(await t.db.select().from(reviews)).toEqual([])
    }, 90_000)

    it('once delivered: the form data, one review per line, then "submitted"; it waits as pending', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const o = await (await delivered(p)).deliver()
      expect((await shop('GET', `/orders/by-token/${o.token}`)).body.lines[0].review).toEqual({ available: true, submitted: false })
      expect((await invite(o)).body).toMatchObject({ product: { title: expect.any(String) }, displayNameDefault: 'Sana M.', sized: false, submitted: false })

      const sent = await submit(o, { ...FORM, title: 'Beautiful', fit: 'true_to_size' })
      expect(sent).toMatchObject({ status: 201, body: { status: 'pending' } })
      expect(await reviewOf(o.lineId)).toMatchObject({ productId: p.productId, status: 'pending', rating: 5, title: 'Beautiful', fit: 'true_to_size', displayName: 'Sana M.' })
      expect(await submit(o)).toMatchObject({ status: 409, body: { code: 'review_already_submitted' } })
      expect((await invite(o)).body.submitted).toBe(true)
      expect((await shop('GET', `/orders/by-token/${o.token}`)).body.lines[0].review).toEqual({ available: false, submitted: true })
      expect((await t.db.select().from(reviews)).length).toBe(1)
    }, 90_000)

    it('refuses a short text, a rating out of range, a phone number as a field, and the line of another order', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const a = await (await delivered(p)).deliver()
      const b = await (await delivered(p)).deliver()
      expect((await submit(a, { ...FORM, body: 'too short' })).status).toBe(400)
      expect((await submit(a, { ...FORM, rating: 6 })).status).toBe(400)
      expect((await submit(a, { ...FORM, phone: '03001234567' })).status).toBe(400)
      expect((await submit({ token: a.token, lineId: b.lineId })).status).toBe(404) // another order's line
      expect((await submit({ token: 'nope', lineId: a.lineId })).status).toBe(404)
      expect(await t.db.select().from(reviews)).toEqual([])
    }, 120_000)

    it('the window is 90 days from delivery', async () => {
      await ready()
      const o = await (await delivered(await S.product({ price: 200000, stock: 5 }))).deliver()
      setClock(new Date(Date.now() + 89 * 86_400_000))
      expect((await invite(o)).status).toBe(200)
      setClock(new Date(Date.now() + 91 * 86_400_000))
      expect(await invite(o)).toMatchObject({ status: 410, body: { code: 'token_expired' } })
      expect(await submit(o)).toMatchObject({ status: 410, body: { code: 'token_expired' } })
      expect((await shop('GET', `/orders/by-token/${o.token}`)).body.lines[0].review.available).toBe(false)
    }, 90_000)

    it('is switched off with the feature: nothing to write and nothing to read', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const o = await (await delivered(p)).deliver()
      const cur = await S.owner.call('GET', '/admin/settings/store')
      const put = await S.owner.call('PUT', '/admin/settings/store', { body: { value: { ...cur.body.value, features: { ...cur.body.value.features, reviews: false } }, version: cur.body.version } })
      expect(put.status).toBe(200)
      expect((await invite(o)).status).toBe(404)
      expect((await submit(o)).status).toBe(404)
      expect((await listing(p.productId)).status).toBe(404)
    }, 90_000)
  })

  describe('what the product shows', () => {
    it('only approved reviews count: approving adds to the rating, rejecting takes it back, and the earlier values return', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const a = await (await delivered(p)).deliver()
      const b = await (await delivered(p)).deliver()
      await submit(a, { ...FORM, rating: 5 })
      await submit(b, { ...FORM, rating: 4, displayName: 'Ayesha K.' })
      expect((await listing(p.productId)).body).toMatchObject({ items: [], summary: { average: 0, count: 0, byStar: [0, 0, 0, 0, 0] } })
      expect(await ratingOf(p.productId)).toEqual({ avg: null, n: 0 })

      const ra = await reviewOf(a.lineId)
      const rb = await reviewOf(b.lineId)
      expect((await moderate(ra.id, { status: 'approved' })).status).toBe(200)
      expect(await ratingOf(p.productId)).toEqual({ avg: 500, n: 1 })
      expect((await moderate(rb.id, { status: 'approved' })).status).toBe(200)
      expect(await ratingOf(p.productId)).toEqual({ avg: 450, n: 2 })
      const shown = (await listing(p.productId)).body
      expect(shown.summary).toEqual({ average: 4.5, count: 2, byStar: [0, 0, 0, 1, 1] })
      expect(shown.items.map((/** @type {{ displayName: string }} */ r) => r.displayName).sort()).toEqual(['Ayesha K.', 'Sana M.'])
      expect(JSON.stringify(shown)).not.toMatch(/0300|Malik|Gulberg/)

      const rej = await moderate(rb.id, { status: 'rejected', reason: 'spam', note: 'advert' })
      expect(rej.body).toMatchObject({ status: 'rejected', rejectReason: 'spam', rejectNote: 'advert' })
      expect(await ratingOf(p.productId)).toEqual({ avg: 500, n: 1 })
      await moderate(ra.id, { status: 'rejected', reason: 'other' })
      expect(await ratingOf(p.productId)).toEqual({ avg: null, n: 0 }) // as before the first approval
      expect((await listing(p.productId)).body.items).toEqual([])
    }, 150_000)

    it('pages by cursor, newest first, every review once', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 9 })
      const ids = []
      for (let i = 0; i < 3; i++) {
        const o = await (await delivered(p)).deliver()
        await submit(o, { ...FORM, rating: 3 + (i % 3), body: `Review number ${i} of the same dress, which is nice.` })
        const r = await reviewOf(o.lineId)
        await moderate(r.id, { status: 'approved' })
        ids.push(r.id)
      }
      const first = (await listing(p.productId, '?limit=2')).body
      expect(first.items).toHaveLength(2)
      expect(first.nextCursor).toBeTruthy()
      const second = (await listing(p.productId, `?limit=2&cursor=${first.nextCursor}`)).body
      expect(second.items).toHaveLength(1)
      expect(second.nextCursor).toBeUndefined()
      expect([...first.items, ...second.items].map((/** @type {{ id: string }} */ r) => r.id).sort()).toEqual([...ids].sort())
      expect((await listing(p.productId, '?cursor=garbage')).status).toBe(400)
      expect((await listing(uuidv7())).status).toBe(404)
    }, 200_000)
  })

  describe('staff', () => {
    it('reply, remove the reply, and find reviews by status, stars, text and order number', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const a = await (await delivered(p)).deliver()
      const b = await (await delivered(p)).deliver()
      await submit(a, { ...FORM, rating: 5, body: 'The dupatta is stunning, thank you so much.' })
      await submit(b, { ...FORM, rating: 2, body: 'The colour was different from the photo, sadly.' })
      const ra = await reviewOf(a.lineId)
      await moderate(ra.id, { status: 'approved' })

      const replied = await S.owner.call('PUT', `/admin/reviews/${ra.id}/reply`, { body: { body: 'Thank you Sana!' } })
      expect(replied.body.reply).toMatchObject({ body: 'Thank you Sana!' })
      expect((await listing(p.productId)).body.items[0].reply).toMatchObject({ body: 'Thank you Sana!' })
      expect((await S.owner.call('PUT', `/admin/reviews/${ra.id}/reply`, { body: { body: 'x'.repeat(601) } })).status).toBe(400)
      expect((await S.owner.call('PUT', `/admin/reviews/${ra.id}/reply`, { body: { body: '' } })).body.reply).toBeUndefined()

      const q = async (/** @type {string} */ qs) => (await S.owner.call('GET', `/admin/reviews?${qs}`)).body
      expect((await q('')).total).toBe(2)
      expect((await q('status=pending')).items.map((/** @type {{ id: string }} */ r) => r.id)).toEqual([(await reviewOf(b.lineId)).id])
      expect((await q('rating=5')).total).toBe(1)
      expect((await q('q=dupatta')).total).toBe(1)
      expect((await q(`q=${a.orderNumber}`)).items[0].order.orderNumber).toBe(a.orderNumber)
      expect((await q(`productId=${p.productId}&sort=rating`)).items.map((/** @type {{ rating: number }} */ r) => r.rating)).toEqual([2, 5])
      expect((await q('hasPhotos=1')).total).toBe(0)
      const one = (await S.owner.call('GET', `/admin/reviews/${ra.id}`)).body
      expect(one).toMatchObject({ id: ra.id, status: 'approved', moderatedBy: expect.any(String), order: { orderNumber: a.orderNumber }, product: { id: p.productId } })
      expect((await S.owner.call('GET', `/admin/reviews/${uuidv7()}`)).status).toBe(404)
    }, 150_000)

    it('bulk: each review on its own, the missing one reported and the rest decided', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const a = await (await delivered(p)).deliver()
      const b = await (await delivered(p)).deliver()
      await submit(a)
      await submit(b, { ...FORM, rating: 3 })
      const ids = [(await reviewOf(a.lineId)).id, uuidv7(), (await reviewOf(b.lineId)).id]
      const ok = await S.owner.call('POST', '/admin/reviews/bulk', { body: { ids, action: 'approve' } })
      expect(ok.body).toMatchObject({ succeeded: [ids[0], ids[2]], failed: [{ id: ids[1], code: 'not_found' }] })
      expect(await ratingOf(p.productId)).toEqual({ avg: 400, n: 2 })
      expect((await S.owner.call('POST', '/admin/reviews/bulk', { body: { ids: [ids[0]], action: 'reject' } })).status).toBe(400) // a reason is needed
      await S.owner.call('POST', '/admin/reviews/bulk', { body: { ids: [ids[0]], action: 'reject', reason: 'spam' } })
      expect(await ratingOf(p.productId)).toEqual({ avg: 300, n: 1 })
    }, 120_000)
  })

  describe('photos', () => {
    /** Asks for a slot, PUTs the bytes like the browser would. */
    async function slotFor(/** @type {{ token: string, lineId: string }} */ o, /** @type {Buffer} */ data) {
      const slot = await shop('POST', `/orders/by-token/${o.token}/lines/${o.lineId}/review/uploads`, { body: { contentType: 'image/jpeg', bytes: data.length } })
      if (slot.status !== 200) return slot
      const url = new URL(slot.body.uploadUrl)
      const put = await app.inject({ method: 'PUT', url: url.pathname + url.search, headers: { ...slot.body.headers, origin: ORIGIN }, payload: data })
      expect(put.statusCode).toBe(200)
      return slot
    }
    const jpeg = () => sharp({ create: { width: 400, height: 300, channels: 3, background: '#336699' } }).jpeg().toBuffer()

    it('a photo is uploaded, sent with the review, shown once approved, and removable by staff', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const before = await (await delivered(p))
      expect((await slotFor(before, await jpeg())).status).toBe(409) // not delivered yet
      const o = await before.deliver()
      const slot = await slotFor(o, await jpeg())
      expect(slot.status).toBe(200)
      expect((await t.db.select().from(media).where(eq(media.id, slot.body.mediaId)))[0]).toMatchObject({ uploadedBy: null, status: 'pending' })

      expect((await submit(o, { ...FORM, photoMediaIds: [slot.body.mediaId] })).status).toBe(201)
      await mediaJobs(svc.media)['media.process']?.({ job: { id: 'j', type: 'media.process', payload: { mediaId: slot.body.mediaId }, attempts: 0, maxAttempts: 8 }, signal: new AbortController().signal })
      const r = await reviewOf(o.lineId)
      expect((await S.owner.call('GET', `/admin/reviews/${r.id}`)).body.photos).toMatchObject([{ mediaId: slot.body.mediaId, width: 400 }])
      expect((await S.owner.call('GET', '/admin/reviews?hasPhotos=1')).body.total).toBe(1)
      expect((await listing(p.productId)).body.items).toEqual([]) // not approved yet
      await moderate(r.id, { status: 'approved' })
      expect((await listing(p.productId)).body.items[0].photos).toHaveLength(1)

      const gone = await S.owner.call('DELETE', `/admin/reviews/${r.id}/photos/${slot.body.mediaId}`)
      expect(gone.status).toBe(200)
      expect(gone.body.photos).toEqual([])
      expect(await t.db.select().from(media).where(eq(media.id, slot.body.mediaId))).toEqual([])
      expect((await S.owner.call('DELETE', `/admin/reviews/${r.id}/photos/${slot.body.mediaId}`)).status).toBe(404)
    }, 120_000)

    it('refuses a file nobody uploaded, one a staff member uploaded, one already used, and more than three', async () => {
      await ready()
      const p = await S.product({ price: 200000, stock: 5 })
      const a = await (await delivered(p)).deliver()
      const b = await (await delivered(p)).deliver()
      const phantom = await shop('POST', `/orders/by-token/${a.token}/lines/${a.lineId}/review/uploads`, { body: { contentType: 'image/jpeg', bytes: 1000 } })
      const staffSlot = await S.owner.call('POST', '/admin/media/uploads', { body: { filename: 'x.jpg', contentType: 'image/jpeg', bytes: 1000 } })
      const code = async (/** @type {object} */ o, /** @type {string[]} */ ids) => (await submit(/** @type {never} */ (o), { ...FORM, photoMediaIds: ids })).status
      expect(await code(a, [uuidv7()])).toBe(400) // no such file
      expect(await code(a, [staffSlot.body.mediaId])).toBe(400) // staff's, not a customer's slot
      expect(await code(a, [phantom.body.mediaId])).toBe(400) // the slot was never filled: confirming finds nothing
      expect(await code(a, [uuidv7(), uuidv7(), uuidv7(), uuidv7()])).toBe(400) // four
      const good = await slotFor(b, await jpeg())
      expect(await code(b, [good.body.mediaId])).toBe(201)
      expect(await code(a, [good.body.mediaId])).toBe(400) // already on b's review
      expect(await t.db.select().from(reviewPhotos)).toHaveLength(1)
    }, 120_000)
  })
})

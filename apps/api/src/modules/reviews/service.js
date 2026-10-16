// Product reviews (plan/09-data-model/08-reviews-notifications.md section 2, plan/10-api/03-cart-orders-public.md section 4, plan/07-admin/08-reviews.md).
// A customer writes one review per purchased line through the link of their order; it waits as `pending` until staff approve it, and only approved reviews
// count towards a product's rating and show on its page. The rating columns of the product are recomputed in the same transaction as the decision.
import { and, asc, count, desc, eq, exists, inArray, isNotNull, like, lt, or, sql } from 'drizzle-orm'
import { staffUsers } from '../../db/schema/auth.js'
import { media as mediaTable } from '../../db/schema/media.js'
import { orderLines, orders } from '../../db/schema/orders.js'
import { productOptionValues, products, variantOptionValues } from '../../db/schema/products.js'
import { reviewPhotos, reviews } from '../../db/schema/reviews.js'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { emit } from '../../platform/outbox.js'
import { record } from '../audit/index.js'
import { purge } from '../catalog/common.js'
import { reviewState } from './window.js'

/**
 * @typedef {import('../../platform/db.js').Executor} Db
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 * @typedef {typeof reviews.$inferSelect} ReviewRow
 * @typedef {{ status: 'approved' } | { status: 'rejected', reason: string, note?: string }} Decision
 */

const isDuplicate = (/** @type {unknown} */ e) => /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e).cause?.errno === 1062 || /** @type {{ errno?: number }} */ (e).errno === 1062
const iso = (/** @type {Date | null} */ d) => (d ? d.toISOString() : undefined)
const like$ = (/** @type {string} */ q) => `%${q.replace(/[\\%_]/g, '\\$&')}%`

/** "Ayesha Khan" -> "Ayesha K.". @param {string} name */
const shortName = (name) => {
  const parts = name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.at(-1) : undefined
  return last ? `${parts[0]} ${[...last][0]}.` : (parts[0] ?? '')
}

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ value: (key: 'store', x: Db) => Promise<{ value: any }> }} deps.settings
 * @param {{ createUpload: (actor: undefined, i: { contentType: 'image/jpeg' | 'image/png' | 'image/webp', bytes: number }) => Promise<{ mediaId: string, uploadUrl: string, headers: Record<string, string>, expiresAt: string }>, confirm: (id: string) => Promise<unknown>, imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>>, remove: (actor: Staff, id: string, req: RequestInfo) => Promise<void> }} deps.media
 * @param {{ orderByToken: (token: string) => Promise<typeof orders.$inferSelect> }} deps.orders
 * @param {(tx: Db, productId: string) => Promise<void>} deps.recomputeRating
 */
export function createReviewsService({ db, settings, media, orders: orderSide, recomputeRating }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  const featureOn = async () => Boolean((await settings.value('store', db)).value.features?.reviews)

  // ---------------------------------------------------------------- the customer's side
  /** The order behind the link and the line in it, or an error. Reviews switched off look like no such page. @param {string} token @param {string} lineId */
  async function lineOf(token, lineId) {
    const order = await orderSide.orderByToken(token)
    const [line] = await db.select().from(orderLines).where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, order.id)))
    if (!line || !(await featureOn())) throw new DomainError('not_found')
    return { order, line }
  }

  /** @param {string} lineId */
  const submitted = async (lineId) => (await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.orderLineId, lineId))).length > 0

  /** Everything the public sees of reviews, photos as ready images. @param {ReviewRow[]} rows */
  async function publicViews(rows) {
    if (!rows.length) return []
    const photos = await db.select().from(reviewPhotos).where(inArray(reviewPhotos.reviewId, rows.map((r) => r.id))).orderBy(asc(reviewPhotos.sortOrder))
    const images = await media.imagesFor(photos.map((p) => p.mediaId))
    return rows.map((r) => ({
      id: r.id, displayName: r.displayName, rating: r.rating, ...(r.title ? { title: r.title } : {}), body: r.body, ...(r.fit ? { fit: /** @type {never} */ (r.fit) } : {}),
      photos: photos.filter((p) => p.reviewId === r.id).flatMap((p) => (images[p.mediaId] ? [/** @type {import('@noor/contract').Image} */ (images[p.mediaId])] : [])),
      createdAt: r.createdAt.toISOString(),
      ...(r.replyBody && r.replyAt ? { reply: { body: r.replyBody, createdAt: r.replyAt.toISOString() } } : {}),
    }))
  }

  // ---------------------------------------------------------------- the staff's side
  /** The names of the staff who decided these reviews; none decided yet is no query at all. @param {Db} x @param {ReviewRow[]} rows */
  async function moderators(x, rows) {
    const ids = [...new Set(rows.flatMap((r) => (r.moderatedBy ? [r.moderatedBy] : [])))]
    return ids.length ? x.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, ids)) : []
  }

  /** @param {Db} x @param {ReviewRow[]} rows @returns {Promise<import('@noor/contract').AdminReview[]>} */
  async function adminViews(x, rows) {
    if (!rows.length) return []
    const ids = rows.map((r) => r.id)
    const [lines, photos, staff] = await Promise.all([
      x.select({ id: orderLines.id, imageMediaId: orderLines.imageMediaId, orderId: orders.id, prefix: orders.numberPrefix, number: orders.number }).from(orderLines).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(inArray(orderLines.id, rows.map((r) => r.orderLineId))),
      x.select().from(reviewPhotos).where(inArray(reviewPhotos.reviewId, ids)).orderBy(asc(reviewPhotos.sortOrder)),
      moderators(x, rows),
    ])
    const prods = await x.select({ id: products.id, title: products.title }).from(products).where(inArray(products.id, rows.map((r) => r.productId)))
    const images = await media.imagesFor([...photos.map((p) => p.mediaId), ...lines.flatMap((l) => (l.imageMediaId ? [l.imageMediaId] : []))])
    return rows.map((r) => {
      const line = lines.find((l) => l.id === r.orderLineId)
      const productImage = line?.imageMediaId ? images[line.imageMediaId] : undefined
      const mod = staff.find((s) => s.id === r.moderatedBy)
      return {
        id: r.id,
        product: { id: r.productId, title: prods.find((p) => p.id === r.productId)?.title ?? '', ...(productImage ? { image: productImage } : {}) },
        order: { id: line?.orderId ?? '', orderNumber: line ? `${line.prefix}-${line.number}` : '' },
        displayName: r.displayName, rating: r.rating, ...(r.title ? { title: r.title } : {}), body: r.body, ...(r.fit ? { fit: /** @type {never} */ (r.fit) } : {}),
        photos: photos.filter((p) => p.reviewId === r.id).flatMap((p) => (images[p.mediaId] ? [{ ...images[p.mediaId], mediaId: p.mediaId }] : [])).map((p) => /** @type {never} */ (p)),
        status: /** @type {never} */ (r.status),
        ...(r.rejectReason ? { rejectReason: /** @type {never} */ (r.rejectReason) } : {}), ...(r.rejectNote ? { rejectNote: r.rejectNote } : {}),
        ...(r.replyBody && r.replyAt ? { reply: { body: r.replyBody, at: r.replyAt.toISOString() } } : {}),
        ...(mod ? { moderatedBy: mod.name } : {}), ...(r.moderatedAt ? { moderatedAt: iso(r.moderatedAt) } : {}),
        createdAt: r.createdAt.toISOString(),
      }
    })
  }

  /** @param {Db} x @param {string} id */
  async function adminView(x, id) {
    const [row] = await x.select().from(reviews).where(eq(reviews.id, id))
    if (!row) throw new DomainError('not_found')
    return /** @type {import('@noor/contract').AdminReview} */ ((await adminViews(x, [row]))[0])
  }

  /** The product's pages are cached: tell the storefront which ones to drop. @param {Db} tx @param {string} productId @param {string} requestId */
  async function purgeProduct(tx, productId, requestId) {
    const [p] = await tx.select({ handle: products.handle }).from(products).where(eq(products.id, productId))
    if (p) await purge(tx, ['products', `product:${p.handle}`], requestId)
  }

  /** One decision on one review, in the caller's transaction: the row, the product's rating, the audit entry and the event. @param {Db} tx @param {Staff} actor @param {string} id @param {Decision} d @param {RequestInfo} req */
  async function decide(tx, actor, id, d, req) {
    const [r] = await tx.select().from(reviews).where(eq(reviews.id, id)).for('update')
    if (!r) throw new DomainError('not_found')
    const at = now()
    await tx.update(reviews).set({
      status: d.status, rejectReason: d.status === 'rejected' ? d.reason : null, rejectNote: d.status === 'rejected' ? (d.note ?? null) : null,
      moderatedBy: actor.staffId, moderatedAt: at, updatedAt: at,
    }).where(eq(reviews.id, id))
    await recomputeRating(tx, r.productId)
    await record(tx, { ...actorOf(actor, req), action: `review.${d.status}`, entityType: 'review', entityId: id, entityLabel: r.displayName, diff: { status: [r.status, d.status] } })
    await emit(tx, { type: `review.${d.status === 'approved' ? 'approved' : 'rejected'}`, payload: { reviewId: id, productId: r.productId }, requestId: req.requestId })
    await purgeProduct(tx, r.productId, req.requestId)
  }

  return {
    // ================================ public
    /** Approved reviews of a product, newest first, with the star counts. @param {string} productId @param {{ limit: number, cursor?: string | undefined }} q */
    async listForProduct(productId, { limit, cursor }) {
      if (!(await featureOn())) throw new DomainError('not_found')
      const [p] = await db.select({ id: products.id, status: products.status }).from(products).where(eq(products.id, productId))
      if (!p || p.status !== 'active') throw new DomainError('not_found')
      const approved = and(eq(reviews.productId, productId), eq(reviews.status, 'approved'))
      const stars = await db.select({ rating: reviews.rating, n: count() }).from(reviews).where(approved).groupBy(reviews.rating)
      const byStar = /** @type {[number, number, number, number, number]} */ ([1, 2, 3, 4, 5].map((s) => stars.find((x) => x.rating === s)?.n ?? 0))
      const fits = await db.select({ fit: reviews.fit, n: count() }).from(reviews).where(and(approved, isNotNull(reviews.fit))).groupBy(reviews.fit)
      const fitOf = (/** @type {string} */ k) => fits.find((x) => x.fit === k)?.n ?? 0
      const fitTotal = fits.reduce((a, x) => a + x.n, 0)
      const total = byStar.reduce((a, b) => a + b, 0)
      const sum = byStar.reduce((a, n, i) => a + n * (i + 1), 0)

      let after = approved
      if (cursor) {
        const [ms, id] = Buffer.from(cursor, 'base64url').toString().split('.')
        const t = new Date(Number(ms))
        if (!ms || !id || Number.isNaN(t.getTime())) throw new DomainError('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_format' }] })
        after = and(approved, or(lt(reviews.createdAt, t), and(eq(reviews.createdAt, t), lt(reviews.id, id))))
      }
      const rows = await db.select().from(reviews).where(after).orderBy(desc(reviews.createdAt), desc(reviews.id)).limit(limit + 1)
      const page = rows.slice(0, limit)
      const last = page.at(-1)
      return {
        items: await publicViews(page),
        ...(rows.length > limit && last ? { nextCursor: Buffer.from(`${last.createdAt.getTime()}.${last.id}`).toString('base64url') } : {}),
        summary: {
          average: total ? Math.round((sum / total) * 100) / 100 : 0, count: total, byStar,
          ...(fitTotal >= 3 ? { fit: { runs_small: fitOf('runs_small'), true_to_size: fitOf('true_to_size'), runs_large: fitOf('runs_large') } } : {}),
        },
      }
    },

    /** What the review form shows for a line of the order. @param {string} token @param {string} lineId */
    async getInvite(token, lineId) {
      const { order, line } = await lineOf(token, lineId)
      const state = reviewState(order, line, now())
      if (state === 'not_delivered') throw new DomainError('not_found')
      if (state === 'expired') throw new DomainError('token_expired')
      const sized = (await db.select({ id: productOptionValues.id }).from(variantOptionValues).innerJoin(productOptionValues, eq(productOptionValues.id, variantOptionValues.optionValueId)).where(and(eq(variantOptionValues.variantId, line.variantId), sql`${productOptionValues.sizeSystemValueId} is not null`))).length > 0
      const image = line.imageMediaId ? (await media.imagesFor([line.imageMediaId]))[line.imageMediaId] : undefined
      return { product: { title: line.title, ...(image ? { image } : {}) }, displayNameDefault: shortName(order.customerName), sized, submitted: await submitted(line.id) }
    },

    /** A slot to upload one photo of the review into; the picture is checked and attached when the review is sent. @param {string} token @param {string} lineId @param {{ contentType: 'image/jpeg' | 'image/png' | 'image/webp', bytes: number }} input */
    async createPhotoUpload(token, lineId, input) {
      const { order, line } = await lineOf(token, lineId)
      const state = reviewState(order, line, now())
      if (state === 'expired') throw new DomainError('token_expired')
      if (state !== 'ok') throw new DomainError('action_not_allowed')
      return media.createUpload(undefined, input)
    },

    /** @param {string} token @param {string} lineId @param {import('@noor/contract').ReviewInput} input */
    async createForOrderLine(token, lineId, input) {
      const { order, line } = await lineOf(token, lineId)
      const state = reviewState(order, line, now())
      if (state === 'expired') throw new DomainError('token_expired')
      if (state !== 'ok') throw new DomainError('action_not_allowed')
      if (await submitted(line.id)) throw new DomainError('review_already_submitted')

      // photos: slots made for reviews (no staff member), not used before; confirming checks the bytes are there
      const photoIds = [...new Set(input.photoMediaIds ?? [])]
      if (photoIds.length) {
        const rows = await db.select({ id: mediaTable.id, uploadedBy: mediaTable.uploadedBy, status: mediaTable.status }).from(mediaTable).where(inArray(mediaTable.id, photoIds))
        const used = await db.select({ id: reviewPhotos.mediaId }).from(reviewPhotos).where(inArray(reviewPhotos.mediaId, photoIds))
        const bad = photoIds.some((id) => { const m = rows.find((r) => r.id === id); return !m || m.uploadedBy !== null || m.status === 'rejected' || used.some((u) => u.id === id) })
        if (bad) throw new DomainError('validation_failed', { issues: [{ path: 'photoMediaIds', code: 'invalid_format' }] })
        for (const id of photoIds) await media.confirm(id)
      }

      const id = uuidv7()
      const at = now()
      try {
        await transaction(db, async (tx) => {
          await tx.insert(reviews).values({
            id, productId: line.productId, orderLineId: line.id, displayName: input.displayName, rating: input.rating, title: input.title ?? null, body: input.body, fit: input.fit ?? null,
            status: 'pending', locale: order.locale, createdAt: at, updatedAt: at,
          })
          if (photoIds.length) await tx.insert(reviewPhotos).values(photoIds.map((mediaId, i) => ({ reviewId: id, mediaId, sortOrder: i })))
        })
      } catch (e) {
        if (isDuplicate(e)) throw new DomainError('review_already_submitted')
        throw e
      }
      return { status: /** @type {const} */ ('pending') }
    },

    // ================================ staff
    /** @param {{ q?: string | undefined, status?: 'pending' | 'approved' | 'rejected' | undefined, rating?: number | undefined, productId?: string | undefined, hasPhotos?: boolean | undefined, sort?: string | undefined, page: number, size: number }} q */
    async list(q) {
      const text = q.q ? like$(q.q) : undefined
      const where = and(
        q.status ? eq(reviews.status, q.status) : undefined,
        q.rating ? eq(reviews.rating, q.rating) : undefined,
        q.productId ? eq(reviews.productId, q.productId) : undefined,
        q.hasPhotos ? exists(db.select({ x: sql`1` }).from(reviewPhotos).where(eq(reviewPhotos.reviewId, reviews.id))) : undefined,
        text ? or(like(reviews.body, text), like(reviews.title, text), like(reviews.displayName, text), like(products.title, text), like(sql`concat(${orders.numberPrefix}, '-', ${orders.number})`, text)) : undefined,
      )
      const base = db.select({ r: reviews }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).innerJoin(orderLines, eq(orderLines.id, reviews.orderLineId)).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(where)
      const field = (q.sort ?? '-createdAt').replace(/^-/, '')
      const dir = (q.sort ?? '-createdAt').startsWith('-') ? desc : asc
      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).innerJoin(orderLines, eq(orderLines.id, reviews.orderLineId)).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(where)
      const rows = await base.orderBy(dir(field === 'rating' ? reviews.rating : reviews.createdAt), desc(reviews.id)).limit(q.size).offset((q.page - 1) * q.size)
      return { items: await adminViews(db, rows.map((x) => x.r)), total: n, page: q.page, size: q.size }
    },

    /** @param {string} id */
    get: (id) => adminView(db, id),

    /** @param {Staff} actor @param {string} id @param {Decision} d @param {RequestInfo} req */
    async moderate(actor, id, d, req) {
      await transaction(db, (tx) => decide(tx, actor, id, d, req))
      return adminView(db, id)
    },

    /** One reply per review, public; an empty text removes it. @param {Staff} actor @param {string} id @param {string} body @param {RequestInfo} req */
    async reply(actor, id, body, req) {
      await transaction(db, async (tx) => {
        const [r] = await tx.select().from(reviews).where(eq(reviews.id, id)).for('update')
        if (!r) throw new DomainError('not_found')
        const at = now()
        await tx.update(reviews).set({ replyBody: body || null, replyAt: body ? at : null, updatedAt: at }).where(eq(reviews.id, id))
        await record(tx, { ...actorOf(actor, req), action: body ? 'review.replied' : 'review.reply_removed', entityType: 'review', entityId: id, entityLabel: r.displayName })
        await purgeProduct(tx, r.productId, req.requestId)
      })
      return adminView(db, id)
    },

    /** A photo that should not be shown: the link goes, then the file. @param {Staff} actor @param {string} id @param {string} mediaId @param {RequestInfo} req */
    async removePhoto(actor, id, mediaId, req) {
      await transaction(db, async (tx) => {
        const [r] = await tx.select().from(reviews).where(eq(reviews.id, id)).for('update')
        const [p] = r ? await tx.select().from(reviewPhotos).where(and(eq(reviewPhotos.reviewId, id), eq(reviewPhotos.mediaId, mediaId))) : []
        if (!r || !p) throw new DomainError('not_found')
        await tx.delete(reviewPhotos).where(and(eq(reviewPhotos.reviewId, id), eq(reviewPhotos.mediaId, mediaId)))
        await record(tx, { ...actorOf(actor, req), action: 'review.photo_removed', entityType: 'review', entityId: id, entityLabel: r.displayName })
        await purgeProduct(tx, r.productId, req.requestId)
      })
      await media.remove(actor, mediaId, req)
      return adminView(db, id)
    },

    /** Approve or reject many: each on its own, so one that is gone does not stop the rest. @param {Staff} actor @param {string[]} ids @param {Decision} d @param {RequestInfo} req */
    async bulk(actor, ids, d, req) {
      /** @type {string[]} */
      const succeeded = []
      /** @type {{ id: string, code: string }[]} */
      const failed = []
      for (const id of ids) {
        try {
          await transaction(db, (tx) => decide(tx, actor, id, d, req))
          succeeded.push(id)
        } catch (e) {
          if (!(e instanceof DomainError)) throw e
          failed.push({ id, code: e.code })
        }
      }
      return { succeeded, failed }
    },
  }
}

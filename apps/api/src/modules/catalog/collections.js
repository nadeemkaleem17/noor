// Collections: hand-picked, ordered sets of products with their own page (plan/10-api/05 section 6, DOC-07.4 section 3).
// Membership is stored once, here, in `collection_products`.
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { readyIds } from '../media/repository.js'
import { diffOf, record } from '../audit/index.js'
import { collectionProducts, collections, products } from '../../db/schema/products.js'
import { actorOf, duplicateKey, purge } from './common.js'
import * as taxonomy from './repository.js'

/** @typedef {import('./common.js').Staff} Staff */
/** @typedef {import('./common.js').RequestInfo} RequestInfo */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').CollectionInput>} CollectionInput */
/** @typedef {typeof collections.$inferSelect} CollectionRow */

const MAX_FEATURED = 3
const issue = (/** @type {string} */ path, /** @type {import('@noor/contract').FieldIssueCode} */ code) => new DomainError('validation_failed', { issues: [{ path, code }] })

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 * @param {(x: import('../../platform/db.js').Executor, ids: string[]) => Promise<import('@noor/contract').z.infer<typeof import('@noor/contract').AdminProductRow>[]>} deps.rowsOf product rows for a list, in the order given
 */
export function createCollections({ db, media, rowsOf }) {
  /** @param {import('../../platform/db.js').Executor} x @param {string} id */
  async function view(x, id) {
    const c = (await x.select().from(collections).where(eq(collections.id, id)))[0]
    if (!c) throw new DomainError('not_found')
    const members = await x.select().from(collectionProducts).where(eq(collectionProducts.collectionId, id)).orderBy(asc(collectionProducts.sortOrder))
    const ids = members.map((m) => m.productId)
    const ur = /** @type {{ ur?: { title?: string, description?: string } } | null} */ (c.i18n)?.ur
    const image = c.imageMediaId ? (await media.imagesFor([c.imageMediaId]))[c.imageMediaId] : undefined
    return {
      id: c.id,
      title: c.title,
      handle: c.handle,
      ...(c.description ? { description: c.description } : {}),
      imageMediaId: c.imageMediaId,
      status: /** @type {'draft' | 'active'} */ (c.status),
      featured: c.featured,
      ...(c.startsAt ? { startsAt: c.startsAt.toISOString() } : {}),
      ...(c.endsAt ? { endsAt: c.endsAt.toISOString() } : {}),
      productIds: ids,
      ...(c.seoTitle || c.seoDescription ? { seo: { ...(c.seoTitle ? { title: c.seoTitle } : {}), ...(c.seoDescription ? { description: c.seoDescription } : {}) } } : {}),
      ...(ur ? { i18n: { ur } } : {}),
      version: c.version,
      ...(image ? { image } : {}),
      products: await rowsOf(x, ids),
      updatedAt: c.updatedAt.toISOString(),
    }
  }

  /** @param {CollectionRow | undefined} c @param {string[]} productIds */
  const snapshot = (c, productIds) => (c ? { title: c.title, handle: c.handle, description: c.description, status: c.status, featured: c.featured, startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null, imageMediaId: c.imageMediaId, seoTitle: c.seoTitle, seoDescription: c.seoDescription, products: productIds } : {})

  /** @param {import('../../platform/db.js').Executor} x @param {string} id */
  const memberIds = async (x, id) => (await x.select().from(collectionProducts).where(eq(collectionProducts.collectionId, id)).orderBy(asc(collectionProducts.sortOrder))).map((m) => m.productId)

  /**
   * @param {Staff} actor @param {string | null} id @param {CollectionInput & { version?: number }} input @param {RequestInfo} req
   */
  async function save(actor, id, input, req) {
    const collectionId = id ?? uuidv7()
    try {
      await transaction(db, async (tx) => {
        const at = now()
        const existing = id ? (await tx.select().from(collections).where(eq(collections.id, id)).for('update'))[0] : undefined
        if (id && !existing) throw new DomainError('not_found')
        if (existing && existing.version !== input.version) throw new DomainError('stale_write', { currentVersion: existing.version })
        if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) throw issue('endsAt', 'invalid_format')
        if (new Set(input.productIds).size !== input.productIds.length) throw issue('productIds', 'not_unique')
        if (input.productIds.length) {
          const found = new Set((await tx.select({ id: products.id }).from(products).where(inArray(products.id, input.productIds))).map((p) => p.id))
          const missing = input.productIds.findIndex((p) => !found.has(p))
          if (missing >= 0) throw issue(`productIds.${missing}`, 'invalid_format')
        }
        if (input.imageMediaId && !(await readyIds(tx, [input.imageMediaId])).has(input.imageMediaId)) throw new DomainError('media_not_ready', { mediaId: input.imageMediaId })

        // at most three collections are featured: a fourth must say which one makes room
        if (input.featured) {
          const others = (await tx.select().from(collections).where(eq(collections.featured, true)).for('update')).filter((c) => c.id !== collectionId)
          if (others.length >= MAX_FEATURED) {
            const replaced = input.replaceFeaturedId ? others.find((c) => c.id === input.replaceFeaturedId) : undefined
            if (!replaced) throw new DomainError('validation_failed', { issues: [{ path: 'featured', code: 'too_big' }], featured: others.map((c) => ({ id: c.id, title: c.title })) })
            await tx.update(collections).set({ featured: false, version: replaced.version + 1, updatedAt: at }).where(eq(collections.id, replaced.id))
            await record(tx, { ...actorOf(actor, req), action: 'collection.updated', entityType: 'collection', entityId: replaced.id, entityLabel: replaced.handle, diff: { featured: [true, false] } })
          }
        }

        const before = existing ? snapshot(existing, await memberIds(tx, collectionId)) : {}
        const cols = {
          handle: input.handle,
          title: input.title,
          description: input.description ?? '',
          imageMediaId: input.imageMediaId ?? null,
          status: input.status,
          featured: input.featured,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          seoTitle: input.seo?.title || null,
          seoDescription: input.seo?.description || null,
          i18n: input.i18n?.ur && (input.i18n.ur.title || input.i18n.ur.description) ? { ur: input.i18n.ur } : null,
        }
        if (existing) {
          if (input.handle !== existing.handle) {
            await taxonomy.dropRedirect(tx, 'collection', input.handle)
            await taxonomy.upsertRedirect(tx, 'collection', existing.handle, collectionId, at)
          }
          await tx.update(collections).set({ ...cols, version: existing.version + 1, updatedAt: at }).where(eq(collections.id, collectionId))
        } else {
          await taxonomy.dropRedirect(tx, 'collection', input.handle)
          await tx.insert(collections).values({ id: collectionId, ...cols, version: 1, createdAt: at, updatedAt: at })
        }
        await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId))
        if (input.productIds.length) await tx.insert(collectionProducts).values(input.productIds.map((productId, i) => ({ collectionId, productId, sortOrder: i })))
        const after = snapshot((await tx.select().from(collections).where(eq(collections.id, collectionId)))[0], input.productIds)
        await record(tx, { ...actorOf(actor, req), action: existing ? 'collection.updated' : 'collection.created', entityType: 'collection', entityId: collectionId, entityLabel: input.handle, diff: diffOf(before, after) })
        await purge(tx, ['collections', `collection:${input.handle}`, 'home'], req.requestId)
      })
    } catch (e) {
      if (duplicateKey(e) === 'collections_handle_uq') throw new DomainError('handle_taken')
      throw e
    }
    return view(db, collectionId)
  }

  return {
    /** @param {{ q?: string, status?: string, sort?: string, page: number, size: number }} f */
    async list(f) {
      const sorts = { title: collections.title, status: collections.status, updatedAt: collections.updatedAt }
      const field = (f.sort ?? '-updatedAt').replace(/^-/, '')
      if (!(field in sorts)) throw issue('sort', 'invalid_format')
      const column = sorts[/** @type {keyof typeof sorts} */ (field)]
      const where = and(f.status ? eq(collections.status, f.status) : undefined, f.q ? or(like(collections.title, `%${f.q}%`), like(collections.handle, `%${f.q.toLowerCase()}%`)) : undefined)
      const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(collections).where(where)
      const rows = await db.select().from(collections).where(where).orderBy((f.sort ?? '-updatedAt').startsWith('-') ? desc(column) : asc(column), asc(collections.id)).limit(f.size).offset((f.page - 1) * f.size)
      const counts = rows.length ? await db.select({ id: collectionProducts.collectionId, n: count() }).from(collectionProducts).where(inArray(collectionProducts.collectionId, rows.map((r) => r.id))).groupBy(collectionProducts.collectionId) : []
      return {
        items: rows.map((c) => ({ id: c.id, title: c.title, handle: c.handle, status: /** @type {'draft' | 'active'} */ (c.status), featured: c.featured, productCount: counts.find((n) => n.id === c.id)?.n ?? 0, updatedAt: c.updatedAt.toISOString() })),
        total, page: f.page, size: f.size,
      }
    },
    get: (/** @type {string} */ id) => view(db, id),
    create: (/** @type {Staff} */ actor, /** @type {CollectionInput} */ input, /** @type {RequestInfo} */ req) => save(actor, null, input, req),
    update: (/** @type {Staff} */ actor, /** @type {string} */ id, /** @type {CollectionInput & { version: number }} */ input, /** @type {RequestInfo} */ req) => save(actor, id, input, req),

    /** Products are untouched. @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async remove(actor, id, req) {
      await transaction(db, async (tx) => {
        const c = (await tx.select().from(collections).where(eq(collections.id, id)).for('update'))[0]
        if (!c) throw new DomainError('not_found')
        const members = await memberIds(tx, id)
        await tx.delete(collections).where(eq(collections.id, id))
        await taxonomy.dropRedirectsOf(tx, 'collection', id)
        await record(tx, { ...actorOf(actor, req), action: 'collection.deleted', entityType: 'collection', entityId: id, entityLabel: c.handle, diff: diffOf(snapshot(c, members), {}) })
        await purge(tx, ['collections', `collection:${c.handle}`, 'home'], req.requestId)
      })
    },
  }
}

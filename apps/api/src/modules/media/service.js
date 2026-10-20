// Media: upload slots, confirmation, processing, reading, alt text, deletion (plan/08 section 11, plan/10-api/05 section 3).
// The browser sends the file to storage itself. Nothing it says about the file is believed: `media.process` reads the bytes.
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { complete, enqueue } from '../../platform/jobs.js'
import { newMediaKey } from '../../platform/storage.js'
import { record } from '../audit/index.js'
import { EXTENSIONS, SNIFF_BYTES, sniff, toImage } from './images.js'
import { RejectedUpload, processImage } from './processor.js'
import * as repo from './repository.js'

const DAY = 86_400_000
/**
 * The default time a confirm request may spend making the picture ready itself (`MEDIA_INLINE_BUDGET_MS`). Most pictures are done well inside it, so the person sees
 * the result at once and nothing waits for a queue; a slow or failing one is left to the background job, which is always queued first (nothing is lost if this process dies half way).
 */
export const INLINE_BUDGET_MS = 6_000

/**
 * @typedef {{ staffId: string, name: string, role: string }} Staff
 * @typedef {{ ip: string, userAgent: string, requestId: string }} RequestInfo
 */

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('../../platform/config.js').Config} deps.config
 * @param {import('../../platform/storage.js').Storage} deps.storage
 * @param {(mediaId: string) => Promise<boolean>} [deps.inUse] does something outside the database's foreign keys (a settings document) still use this file?
 * @param {number} [deps.inlineBudgetMs] overrides the configuration (tests); 0 always leaves the work to the queue
 */
export function createMediaService({ db, config, storage, inUse = async () => false, inlineBudgetMs = config.MEDIA_INLINE_BUDGET_MS ?? INLINE_BUDGET_MS }) {
  /** @param {Staff} a @param {RequestInfo} req */
  const actorOf = (a, req) => ({ actor: { type: /** @type {const} */ ('staff'), id: a.staffId, label: a.name, role: a.role }, ip: req.ip, userAgent: req.userAgent, requestId: req.requestId })

  /** @param {repo.MediaRow} m @returns {import('@noor/contract').MediaInfo} */
  const toInfo = (m) => {
    const ur = /** @type {{ ur?: { alt?: string } } | null} */ (m.i18n)?.ur
    return {
      id: m.id,
      kind: /** @type {'image'} */ (m.kind),
      status: /** @type {import('@noor/contract').MediaInfo['status']} */ (m.status),
      ...(m.rejectReason ? { rejectReason: m.rejectReason } : {}),
      ...(m.status === 'ready' && m.width && m.height
        ? { image: toImage({ objectKey: m.objectKey, width: m.width, height: m.height, alt: m.alt, lqip: m.lqip }, config.IMG_BASE_URL), width: m.width, height: m.height }
        : {}),
      bytes: m.bytes,
      alt: m.alt,
      ...(ur ? { i18n: { ur } } : {}),
      createdAt: m.createdAt.toISOString(),
    }
  }

  /** @param {string} id */
  const mustFind = async (id) => {
    const m = await repo.find(db, id)
    if (!m) throw new DomainError('not_found')
    return m
  }

  /** Marks a file refused and removes its bytes. @param {repo.MediaRow} m @param {string} reason */
  const reject = async (m, reason) => {
    await repo.update(db, m.id, { status: 'rejected', rejectReason: reason })
    await storage.removeWithSizes(m.objectKey)
  }

  const self = {
    /** A customer's review photo has no staff member behind it (`actor` undefined). @param {Staff | undefined} actor @param {{ contentType: keyof typeof EXTENSIONS, bytes: number }} input */
    async createUpload(actor, { contentType, bytes }) {
      const id = uuidv7()
      const objectKey = newMediaKey(EXTENSIONS[contentType])
      await repo.insert(db, { id, kind: 'image', status: 'pending', objectKey, contentType, bytes, uploadedBy: actor?.staffId ?? null, createdAt: now() })
      const put = storage.presignPut(objectKey, { contentType, bytes })
      return { mediaId: id, uploadUrl: put.url, headers: put.headers, expiresAt: put.expiresAt.toISOString() }
    },

    /** The browser says the file is up. Checks something is there, then queues the real inspection. @param {string} id */
    async confirm(id) {
      const m = await mustFind(id)
      if (m.status !== 'pending' || m.confirmedAt) return toInfo(m) // confirming twice changes nothing
      if ((await storage.size(m.objectKey)) === null) throw new DomainError('validation_failed', { issues: [{ path: 'upload', code: 'required' }] })
      /** @type {string} */
      let jobId = ''
      await transaction(db, async (tx) => {
        await repo.update(tx, id, { confirmedAt: now() })
        jobId = await enqueue(tx, { type: 'media.process', payload: { mediaId: id }, uniqueKey: `media.process:${id}` })
      })
      // the fast path: make it ready now if that takes no longer than the budget; then the queued job is no longer needed
      if (inlineBudgetMs > 0) {
        let timer
        const finished = await Promise.race([
          self.process(id).then(() => true, () => false),
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(false), inlineBudgetMs)
          }),
        ])
        clearTimeout(timer)
        if (finished) await complete(db, jobId)
      }
      return toInfo(await mustFind(id))
    },

    /** The `Image` of each ready file among `ids`, by id: what settings and content responses embed. @param {string[]} ids */
    async imagesFor(ids) {
      /** @type {Record<string, import('@noor/contract').Image>} */
      const out = {}
      for (const m of await repo.findMany(db, [...new Set(ids)])) {
        if (m.status === 'ready' && m.width && m.height) out[m.id] = toImage({ objectKey: m.objectKey, width: m.width, height: m.height, alt: m.alt, lqip: m.lqip }, config.IMG_BASE_URL)
      }
      return out
    },

    /** @param {string} id */
    async get(id) {
      return toInfo(await mustFind(id))
    },

    /** @param {Staff} actor @param {string} id @param {{ alt: string, i18n?: { ur?: { alt?: string } } }} input @param {RequestInfo} req */
    async update(actor, id, { alt, i18n }, req) {
      return transaction(db, async (tx) => {
        const m = await repo.lock(tx, id)
        if (!m) throw new DomainError('not_found')
        const before = /** @type {{ ur?: { alt?: string } } | null} */ (m.i18n)?.ur?.alt ?? ''
        const after = i18n?.ur?.alt ?? ''
        await repo.update(tx, id, { alt, i18n: after ? { ur: { alt: after } } : null })
        /** @type {Record<string, [unknown, unknown]>} */
        const diff = {}
        if (alt !== m.alt) diff.alt = [m.alt, alt]
        if (after !== before) diff['i18n.ur.alt'] = [before, after]
        await record(tx, { ...actorOf(actor, req), action: 'media.updated', entityType: 'media', entityId: id, entityLabel: m.objectKey, diff })
        return toInfo(/** @type {repo.MediaRow} */ (await repo.find(tx, id)))
      })
    },

    /** A file that something references (a product, a banner ...) cannot go: the foreign keys say so. @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async remove(actor, id, req) {
      const m = await mustFind(id)
      if (await inUse(id)) throw new DomainError('in_use')
      try {
        await transaction(db, async (tx) => {
          await repo.remove(tx, id)
          await record(tx, { ...actorOf(actor, req), action: 'media.deleted', entityType: 'media', entityId: id, entityLabel: m.objectKey })
          // the row goes now, the bytes a moment later and outside the request (plan/09 section 2.1)
          await enqueue(tx, { type: 'media.purge', payload: { objectKey: m.objectKey }, uniqueKey: `media.purge:${id}` })
        })
      } catch (e) {
        const err = /** @type {{ cause?: { errno?: number }, errno?: number }} */ (e)
        if ((err.cause?.errno ?? err.errno) === 1451) throw new DomainError('in_use')
        throw e
      }
    },

    /** Job `media.process`: look at the bytes, then make the file ready or refuse it. @param {string} id */
    async process(id) {
      const m = await repo.find(db, id)
      if (!m || m.status !== 'pending') return // already done, or deleted meanwhile: running twice is fine
      const size = await storage.size(m.objectKey)
      if (size === null) return reject(m, 'missing')
      if (size !== m.bytes) return reject(m, 'size_mismatch')
      const type = sniff(await storage.readHead(m.objectKey, SNIFF_BYTES))
      if (!type) return reject(m, 'not_an_image')
      if (type !== m.contentType) return reject(m, 'type_mismatch')
      try {
        const out = await processImage(await storage.read(m.objectKey), type, m.objectKey)
        for (const s of out.sizes) await storage.put(s.key, s.data)
        await storage.put(m.objectKey, out.original) // the same picture without its metadata
        await repo.update(db, id, { status: 'ready', width: out.width, height: out.height, lqip: out.lqip, bytes: out.original.length })
      } catch (e) {
        if (e instanceof RejectedUpload) return reject(m, e.reason)
        throw e // storage trouble: the worker retries
      }
    },

    /** Job `media.purge`: removes the files of a deleted row. @param {string} objectKey */
    purge: (objectKey) => storage.removeWithSizes(objectKey),

    /** Job `media.cleanup` (daily): slots never confirmed within a day, and refused files after a day. */
    async cleanup() {
      const cutoff = new Date(now().getTime() - DAY)
      for (const find of [repo.staleTickets, repo.oldRejected]) {
        for (const m of await find(db, cutoff, 500)) {
          await repo.remove(db, m.id)
          await storage.removeWithSizes(m.objectKey)
        }
      }
    },
  }
  return self
}

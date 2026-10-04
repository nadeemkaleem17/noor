// Categories: a tree up to three levels deep, ordered among siblings, with the filters (attributes) each one shows (DOC-07.4 section 2).
import { maxCategoryDepth } from '@noor/contract'
import { DomainError } from '../../platform/errors.js'
import { transaction } from '../../platform/db.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'
import { readyIds } from '../media/repository.js'
import { diffOf, record } from '../audit/index.js'
import { actorOf, duplicateKey, isReferenced, purge } from './common.js'
import * as repo from './repository.js'

/** @typedef {import('./common.js').Staff} Staff */
/** @typedef {import('./common.js').RequestInfo} RequestInfo */
/** @typedef {import('@noor/contract').z.infer<typeof import('@noor/contract').CategoryInput>} CategoryInput */

/**
 * @param {object} deps
 * @param {import('../../platform/db.js').Database['db']} deps.db
 * @param {import('./common.js').Usage} deps.usage
 * @param {{ imagesFor: (ids: string[]) => Promise<Record<string, import('@noor/contract').Image>> }} deps.media
 */
export function createCategories({ db, usage, media }) {
  /** @param {repo.CategoryRow[]} all @param {string} id */
  const depthOf = (all, id) => {
    const byId = new Map(all.map((c) => [c.id, c]))
    let depth = 0
    for (let c = byId.get(id); c; c = c.parentId ? byId.get(c.parentId) : undefined) depth += 1
    return depth
  }

  /** The deepest level in the subtree under `id`, counting `id` as level 1. @param {repo.CategoryRow[]} all @param {string} id @returns {number} */
  const subtreeHeight = (all, id) => 1 + Math.max(0, ...all.filter((c) => c.parentId === id).map((c) => subtreeHeight(all, c.id)))

  /** The row as an admin sees it. @param {repo.CategoryRow} c @param {{ attributeId: string, seoIndexable: boolean, required: boolean }[]} filters @param {number} productCount @param {import('@noor/contract').Image | undefined} image */
  const toAdmin = (c, filters, productCount, image) => {
    const ur = /** @type {{ ur?: { name?: string, description?: string } } | null} */ (c.i18n)?.ur
    return {
      id: c.id,
      name: c.name,
      handle: c.handle,
      parentId: c.parentId,
      ...(c.description ? { description: c.description } : {}),
      imageMediaId: c.imageMediaId,
      visible: c.visible,
      attributes: filters,
      ...(c.seoTitle || c.seoDescription ? { seo: { ...(c.seoTitle ? { title: c.seoTitle } : {}), ...(c.seoDescription ? { description: c.seoDescription } : {}) } } : {}),
      ...(ur && (ur.name || ur.description) ? { i18n: { ur } } : {}),
      sortOrder: c.sortOrder,
      productCount,
      ...(image ? { image } : {}),
      version: c.version,
    }
  }

  /** @param {import('../../platform/db.js').Executor} x */
  async function listAll(x) {
    const [all, filters] = await Promise.all([repo.allCategories(x), repo.allFilters(x)])
    const images = await media.imagesFor(all.flatMap((c) => (c.imageMediaId ? [c.imageMediaId] : [])))
    const counts = await usage.categoryProducts(all.map((c) => c.id))
    return all.map((c) =>
      toAdmin(c, filters.filter((f) => f.categoryId === c.id).map((f) => ({ attributeId: f.attributeId, seoIndexable: f.seoIndexable, required: f.required })), counts.get(c.id) ?? 0, c.imageMediaId ? images[c.imageMediaId] : undefined),
    )
  }

  /** @param {string} id */
  async function view(id) {
    const v = (await listAll(db)).find((c) => c.id === id)
    if (!v) throw new DomainError('not_found')
    return v
  }

  /** Checks everything about an input that needs the database. @param {import('../../platform/db.js').Executor} tx @param {CategoryInput} input @param {string | null} selfId */
  async function validate(tx, input, selfId) {
    const all = await repo.allCategories(tx)
    const parentId = input.parentId ?? null
    if (parentId) {
      if (!all.some((c) => c.id === parentId)) throw new DomainError('validation_failed', { issues: [{ path: 'parentId', code: 'invalid_format' }] })
      // a category cannot sit under itself or one of its own descendants
      for (let c = all.find((x) => x.id === parentId); selfId && c; c = c.parentId ? all.find((x) => x.id === c?.parentId) : undefined) {
        if (c.id === selfId) throw new DomainError('validation_failed', { issues: [{ path: 'parentId', code: 'invalid_format' }] })
      }
      const height = selfId ? subtreeHeight(all, selfId) : 1
      if (depthOf(all, parentId) + height > maxCategoryDepth) throw new DomainError('validation_failed', { issues: [{ path: 'parentId', code: 'too_big' }] })
    }
    if (input.imageMediaId) {
      const ready = await readyIds(tx, [input.imageMediaId])
      if (!ready.has(input.imageMediaId)) throw new DomainError('media_not_ready', { mediaId: input.imageMediaId })
    }
    /** @type {{ path: string, code: 'invalid_format' | 'not_unique' }[]} */
    const issues = []
    const ids = input.attributes.map((a) => a.attributeId)
    const found = new Map((await repo.attributesByIds(tx, [...new Set(ids)])).map((a) => [a.id, a]))
    const seen = new Set()
    input.attributes.forEach((a, i) => {
      if (seen.has(a.attributeId)) issues.push({ path: `attributes.${i}.attributeId`, code: 'not_unique' })
      seen.add(a.attributeId)
      const attribute = found.get(a.attributeId)
      if (!attribute || !attribute.filterable) issues.push({ path: `attributes.${i}.attributeId`, code: 'invalid_format' }) // only filterable attributes are filters
    })
    if (issues.length) throw new DomainError('validation_failed', { issues })
  }

  /** @param {CategoryInput} input */
  const columns = (input) => ({
    parentId: input.parentId ?? null,
    handle: input.handle,
    name: input.name,
    description: input.description ?? '',
    imageMediaId: input.imageMediaId ?? null,
    visible: input.visible,
    seoTitle: input.seo?.title || null,
    seoDescription: input.seo?.description || null,
    i18n: input.i18n?.ur?.name || input.i18n?.ur?.description ? { ur: { ...(input.i18n.ur.name ? { name: input.i18n.ur.name } : {}), ...(input.i18n.ur.description ? { description: input.i18n.ur.description } : {}) } } : null,
  })

  /** What the audit trail compares. @param {import('../../platform/db.js').Executor} x @param {string} id */
  async function snapshot(x, id) {
    const c = /** @type {repo.CategoryRow} */ (await repo.findCategory(x, id))
    const filters = await repo.filtersOf(x, id)
    return { name: c.name, handle: c.handle, parentId: c.parentId, description: c.description, imageMediaId: c.imageMediaId, visible: c.visible, seoTitle: c.seoTitle, seoDescription: c.seoDescription, i18n: c.i18n, filters: filters.map((f) => `${f.attributeId}${f.seoIndexable ? '+seo' : ''}${f.required ? '+req' : ''}`) }
  }

  return {
    list: async () => ({ items: await listAll(db) }),

    /** @param {Staff} actor @param {CategoryInput} input @param {RequestInfo} req */
    async create(actor, input, req) {
      const id = uuidv7()
      try {
        await transaction(db, async (tx) => {
          await validate(tx, input, null)
          const at = now()
          await repo.dropRedirect(tx, 'category', input.handle)
          await repo.insertCategory(tx, { id, ...columns(input), sortOrder: await repo.nextCategoryOrder(tx, input.parentId ?? null), version: 1, createdAt: at, updatedAt: at })
          await repo.replaceFilters(tx, id, input.attributes)
          await record(tx, { ...actorOf(actor, req), action: 'category.created', entityType: 'category', entityId: id, entityLabel: input.handle, diff: diffOf({}, await snapshot(tx, id)) })
          await purge(tx, ['categories'], req.requestId)
        })
      } catch (e) {
        if (duplicateKey(e) === 'categories_handle_uq') throw new DomainError('handle_taken')
        throw e
      }
      return view(id)
    },

    /** @param {Staff} actor @param {string} id @param {CategoryInput & { version: number }} input @param {RequestInfo} req */
    async update(actor, id, input, req) {
      try {
        await transaction(db, async (tx) => {
          const c = await repo.lockCategory(tx, id)
          if (!c) throw new DomainError('not_found')
          if (c.version !== input.version) throw new DomainError('stale_write', { currentVersion: c.version })
          await validate(tx, input, id)
          const before = await snapshot(tx, id)
          const moved = (input.parentId ?? null) !== c.parentId
          if (input.handle !== c.handle) {
            await repo.dropRedirect(tx, 'category', input.handle)
            await repo.upsertRedirect(tx, 'category', c.handle, id, now())
          }
          await repo.updateCategory(tx, id, { ...columns(input), ...(moved ? { sortOrder: await repo.nextCategoryOrder(tx, input.parentId ?? null) } : {}), version: c.version + 1, updatedAt: now() })
          await repo.replaceFilters(tx, id, input.attributes)
          await record(tx, { ...actorOf(actor, req), action: 'category.updated', entityType: 'category', entityId: id, entityLabel: input.handle, diff: diffOf(before, await snapshot(tx, id)) })
          await purge(tx, ['categories'], req.requestId)
        })
      } catch (e) {
        if (duplicateKey(e) === 'categories_handle_uq') throw new DomainError('handle_taken')
        throw e
      }
      return view(id)
    },

    /** Saves the order of one parent's children. @param {Staff} actor @param {{ parentId: string | null, orderedIds: string[] }} input @param {RequestInfo} req */
    async reorder(actor, { parentId, orderedIds }, req) {
      await transaction(db, async (tx) => {
        const children = await repo.childrenOf(tx, parentId)
        const have = new Set(children.map((c) => c.id))
        if (orderedIds.length !== have.size || new Set(orderedIds).size !== have.size || !orderedIds.every((id) => have.has(id))) {
          throw new DomainError('validation_failed', { issues: [{ path: 'orderedIds', code: 'invalid_format' }] })
        }
        const before = children.map((c) => c.handle)
        for (const [i, id] of orderedIds.entries()) await repo.updateCategory(tx, id, { sortOrder: i, updatedAt: now() })
        const byId = new Map(children.map((c) => [c.id, c.handle]))
        await record(tx, { ...actorOf(actor, req), action: 'category.reordered', entityType: 'category', entityId: parentId ?? 'root', entityLabel: parentId ? (await repo.findCategory(tx, parentId))?.handle : 'top level', diff: diffOf({ order: before }, { order: orderedIds.map((id) => byId.get(id)) }) })
        await purge(tx, ['categories'], req.requestId)
      })
    },

    /** Blocked while it has children or is the primary category of a product; says how many. @param {Staff} actor @param {string} id @param {RequestInfo} req */
    async remove(actor, id, req) {
      try {
        await transaction(db, async (tx) => {
          const c = await repo.lockCategory(tx, id)
          if (!c) throw new DomainError('not_found')
          const children = await repo.childCount(tx, id)
          const products = await usage.categoryPrimary(id)
          if (children || products) throw new DomainError('in_use', { usedBy: { children, products } })
          const before = await snapshot(tx, id)
          await repo.deleteCategory(tx, id)
          await repo.dropRedirectsOf(tx, 'category', id)
          await record(tx, { ...actorOf(actor, req), action: 'category.deleted', entityType: 'category', entityId: id, entityLabel: c.handle, diff: diffOf(before, {}) })
          await purge(tx, ['categories'], req.requestId)
        })
      } catch (e) {
        if (isReferenced(e)) throw new DomainError('in_use') // a product or another row still points here
        throw e
      }
    },

    /**
     * The filters a listing of this category shows: its own, or those of the nearest ancestor that has any (DOC-09.3 section 3.4).
     * @param {string} categoryId
     */
    async effectiveFilters(categoryId) {
      const [all, filters] = await Promise.all([repo.allCategories(db), repo.allFilters(db)])
      const byId = new Map(all.map((c) => [c.id, c]))
      for (let c = byId.get(categoryId); c; c = c.parentId ? byId.get(c.parentId) : undefined) {
        const own = filters.filter((f) => f.categoryId === c.id)
        if (own.length) return own.map((f) => ({ attributeId: f.attributeId, seoIndexable: f.seoIndexable, required: f.required }))
      }
      return []
    },
  }
}

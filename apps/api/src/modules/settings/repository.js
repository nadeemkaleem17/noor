import { and, asc, count, desc, eq, like, or } from 'drizzle-orm'
import { pageRedirects, pages, menus, settings } from '../../db/schema/content.js'
import { staffUsers } from '../../db/schema/auth.js'

/** @typedef {import('../../platform/db.js').Executor} Db */
/** @typedef {typeof pages.$inferSelect} PageRow */

// ---- settings documents and menus (the same shape: a JSON value, a version, who and when) ---------------------------------------

/** @param {Db} db @param {string} key */
export async function getSetting(db, key) {
  const [row] = await db
    .select({ value: settings.value, version: settings.version, updatedAt: settings.updatedAt, updatedByName: staffUsers.name })
    .from(settings)
    .leftJoin(staffUsers, eq(staffUsers.id, settings.updatedBy))
    .where(eq(settings.key, key))
  return row
}

/** @param {Db} db @param {string} key */
export const lockSetting = async (db, key) => (await db.select().from(settings).where(eq(settings.key, key)).for('update'))[0]

/** @param {Db} db @param {typeof settings.$inferInsert} row */
export const insertSetting = (db, row) => db.insert(settings).values(row)

/** @param {Db} db @param {string} key @param {Partial<typeof settings.$inferInsert>} set */
export const updateSetting = (db, key, set) => db.update(settings).set(set).where(eq(settings.key, key))

/** @param {Db} db @param {string} handle */
export async function getMenu(db, handle) {
  const [row] = await db
    .select({ items: menus.items, version: menus.version, updatedAt: menus.updatedAt })
    .from(menus)
    .where(eq(menus.handle, handle))
  return row
}

/** @param {Db} db @param {string} handle */
export const lockMenu = async (db, handle) => (await db.select().from(menus).where(eq(menus.handle, handle)).for('update'))[0]

/** @param {Db} db @param {typeof menus.$inferInsert} row */
export const insertMenu = (db, row) => db.insert(menus).values(row)

/** @param {Db} db @param {string} handle @param {Partial<typeof menus.$inferInsert>} set */
export const updateMenu = (db, handle, set) => db.update(menus).set(set).where(eq(menus.handle, handle))

// ---- pages -----------------------------------------------------------------------------------------------------------------

const rowColumns = {
  id: pages.id, slug: pages.slug, title: pages.title, status: pages.status, locked: pages.locked, updatedAt: pages.updatedAt, updatedByName: staffUsers.name,
}
const sortColumns = /** @type {const} */ ({ title: pages.title, updatedAt: pages.updatedAt })

/** @param {Db} db @param {{ q?: string, status?: string, sort?: string, page: number, size: number }} f */
export async function listPages(db, { q, status, sort = '-updatedAt', page, size }) {
  const field = sort.replace(/^-/, '')
  if (!(field in sortColumns)) return null
  const column = sortColumns[/** @type {keyof typeof sortColumns} */ (field)]
  const where = and(
    status ? eq(pages.status, status) : undefined,
    q ? or(like(pages.title, `%${q}%`), like(pages.slug, `%${q.toLowerCase()}%`)) : undefined,
  )
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(pages).where(where)
  const rows = await db
    .select(rowColumns)
    .from(pages)
    .leftJoin(staffUsers, eq(staffUsers.id, pages.updatedBy))
    .where(where)
    .orderBy(sort.startsWith('-') ? desc(column) : asc(column), asc(pages.id))
    .limit(size)
    .offset((page - 1) * size)
  return { rows, total }
}

/** @param {Db} db @param {string} id */
export async function getPage(db, id) {
  const [row] = await db.select({ ...rowColumns, page: pages }).from(pages).leftJoin(staffUsers, eq(staffUsers.id, pages.updatedBy)).where(eq(pages.id, id))
  return row
}

/** @param {Db} db @param {string} id @returns {Promise<PageRow | undefined>} */
export const lockPage = async (db, id) => (await db.select().from(pages).where(eq(pages.id, id)).for('update'))[0]

/** @param {Db} db @param {string} slug @returns {Promise<PageRow | undefined>} */
export const pageBySlug = async (db, slug) => (await db.select().from(pages).where(eq(pages.slug, slug)))[0]

/** @param {Db} db @param {typeof pages.$inferInsert} row */
export const insertPage = (db, row) => db.insert(pages).values(row)

/** @param {Db} db @param {string} id @param {Partial<typeof pages.$inferInsert>} set */
export const updatePage = (db, id, set) => db.update(pages).set(set).where(eq(pages.id, id))

/** @param {Db} db @param {string} id */
export const deletePage = (db, id) => db.delete(pages).where(eq(pages.id, id))

/** @param {Db} db */
export const activePages = (db) =>
  db.select({ slug: pages.slug, title: pages.title, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.status, 'active')).orderBy(asc(pages.title))

/** @param {Db} db @param {string} term */
export const searchActivePages = (db, term) =>
  db
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(and(eq(pages.status, 'active'), or(like(pages.title, `%${term}%`), like(pages.slug, `%${term.toLowerCase()}%`))))
    .orderBy(asc(pages.title))
    .limit(20)

/** The page an old slug now belongs to. @param {Db} db @param {string} oldSlug */
export async function redirectTarget(db, oldSlug) {
  const [row] = await db
    .select({ slug: pages.slug, status: pages.status })
    .from(pageRedirects)
    .innerJoin(pages, eq(pages.id, pageRedirects.pageId))
    .where(eq(pageRedirects.oldSlug, oldSlug))
  return row
}

/** @param {Db} db @param {string} oldSlug @param {string} pageId */
export const upsertRedirect = (db, oldSlug, pageId) =>
  db.insert(pageRedirects).values({ oldSlug, pageId }).onDuplicateKeyUpdate({ set: { pageId } })

/** A slug in use by a page is not a redirect any more. @param {Db} db @param {string} slug */
export const dropRedirect = (db, slug) => db.delete(pageRedirects).where(eq(pageRedirects.oldSlug, slug))


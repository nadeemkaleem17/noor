// The only file of the audit module that reads the table (writing is `record()` in index.js). Read-only by design.
import { and, desc, eq, gte, like, lt, lte, or } from 'drizzle-orm'
import { auditLog } from '../../db/schema/audit.js'

/** @typedef {typeof auditLog.$inferSelect} AuditRow */

const escapeLike = (/** @type {string} */ s) => s.replace(/[\\%_]/g, '\\$&')

/**
 * Newest first. The cursor is the id of the last row of the previous page (ids are UUIDv7, so id order is time order).
 * @param {import('../../platform/db.js').Executor} db
 * @param {{ actorId?: string, entityType?: string, entityId?: string, action?: string, category?: string, from?: string, to?: string, q?: string, limit: number, cursor?: string }} f
 */
export async function listEntries(db, { actorId, entityType, entityId, action, category, from, to, q, limit, cursor }) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        actorId ? eq(auditLog.actorId, actorId) : undefined,
        entityType ? eq(auditLog.entityType, entityType) : undefined,
        entityId ? eq(auditLog.entityId, entityId) : undefined,
        action ? eq(auditLog.action, action) : undefined,
        category ? eq(auditLog.category, category) : undefined,
        from ? gte(auditLog.at, new Date(from)) : undefined,
        to ? lte(auditLog.at, new Date(to)) : undefined,
        cursor ? lt(auditLog.id, cursor) : undefined,
        q ? or(like(auditLog.entityLabel, `%${escapeLike(q)}%`), like(auditLog.actorLabel, `%${escapeLike(q)}%`), like(auditLog.action, `%${escapeLike(q)}%`)) : undefined,
      ),
    )
    .orderBy(desc(auditLog.id))
    .limit(limit + 1) // one extra row says whether another page exists
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}

export const getEntry = (/** @type {import('../../platform/db.js').Executor} */ db, /** @type {string} */ id) => db.select().from(auditLog).where(eq(auditLog.id, id)).then((r) => r[0])

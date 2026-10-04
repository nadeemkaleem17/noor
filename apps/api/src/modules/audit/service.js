// Reading the audit trail (plan/10-api/04 section 5, plan/07-admin/13). There is no write path here: entries are only appended by `record()`.
import { DomainError } from '../../platform/errors.js'
import * as repo from './repository.js'

/** Shows `10.0.0.•••` instead of the last part of an address. @param {string | null} ip */
export function maskIp(ip) {
  if (!ip) return undefined
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:•••` // IPv6: keep the network part
  const parts = ip.split('.')
  return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.•••` : '•••'
}

/** @param {unknown} v */
const show = (v) => (v === null || v === undefined ? 'none' : typeof v === 'object' ? '…' : String(v).length > 40 ? `${String(v).slice(0, 37)}…` : String(v))

/** "price 6990 → 7490; status draft → active": the first three changed fields. @param {Record<string, unknown> | null} diff */
export function summarize(diff) {
  if (!diff) return undefined
  const parts = Object.entries(diff).slice(0, 3).map(([field, change]) => (Array.isArray(change) ? `${field} ${show(change[0])} → ${show(change[1])}` : field))
  return parts.length ? parts.join('; ') : undefined
}

/**
 * @param {repo.AuditRow} r
 * @param {boolean} fullIp owners see the whole address
 */
function toEntry(r, fullIp) {
  const ip = fullIp ? (r.ip ?? undefined) : maskIp(r.ip)
  const summary = summarize(/** @type {Record<string, unknown> | null} */ (r.diff))
  return {
    id: r.id,
    at: r.at.toISOString(),
    actorType: /** @type {'staff' | 'system' | 'storefront'} */ (r.actorType),
    ...(r.actorId ? { actorId: r.actorId } : {}),
    actorLabel: r.actorLabel,
    ...(r.actorRole ? { actorRole: /** @type {import('@noor/contract').StaffRole} */ (r.actorRole) } : {}),
    action: r.action,
    entityType: r.entityType,
    ...(r.entityId ? { entityId: r.entityId } : {}),
    ...(r.entityLabel ? { entityLabel: r.entityLabel } : {}),
    ...(summary ? { summary } : {}),
    ...(r.reason ? { reason: r.reason } : {}),
    category: /** @type {'general' | 'security' | 'money'} */ (r.category),
    ...(ip ? { ip } : {}),
  }
}

/** @param {import('../../platform/db.js').Executor} db */
export function createAuditService(db) {
  return {
    /** @param {{ role: string }} actor @param {Parameters<typeof repo.listEntries>[1]} query */
    async list(actor, query) {
      const { rows, hasMore } = await repo.listEntries(db, query)
      const last = rows[rows.length - 1]
      return { items: rows.map((r) => toEntry(r, actor.role === 'owner')), ...(hasMore && last ? { nextCursor: last.id } : {}) }
    },
    /** @param {{ role: string }} actor @param {string} id */
    async get(actor, id) {
      const r = await repo.getEntry(db, id)
      if (!r) throw new DomainError('not_found')
      return {
        ...toEntry(r, actor.role === 'owner'),
        ...(r.diff ? { diff: /** @type {Record<string, [unknown, unknown] | '[redacted]'>} */ (r.diff) } : {}),
        ...(r.userAgent ? { userAgent: r.userAgent } : {}),
        ...(r.requestId ? { requestId: r.requestId } : {}),
      }
    },
  }
}

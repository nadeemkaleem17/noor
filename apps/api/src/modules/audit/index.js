// The audit trail (plan/11-security-auth.md section 6): written inside the mutating transaction, never updated or deleted.
// Other modules call only `record()` from here.
import { auditLog } from '../../db/schema/audit.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'

/** Fields whose values never reach the log, whatever module wrote them. */
const SECRET_KEY = /pass(word)?|secret|token|hash|recovery|credential|session|cookie|authorization/i

/**
 * Replaces the values of secret-looking fields in a `{ field: [before, after] }` diff.
 * @param {Record<string, unknown> | null | undefined} diff
 * @returns {Record<string, unknown> | null}
 */
export function redactDiff(diff) {
  if (!diff) return null
  return Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[redacted]' : v]))
}

const cut = (/** @type {string | undefined | null} */ s, /** @type {number} */ n) => (s == null ? null : s.slice(0, n))

/**
 * @typedef {object} AuditEntry
 * @property {{ type: 'staff' | 'system' | 'storefront', id?: string | null, label: string, role?: string | null }} actor
 * @property {string} action `<entity>.<verb>`, for example `staff.role_changed`
 * @property {string} entityType
 * @property {string} [entityId]
 * @property {string} [entityLabel]
 * @property {Record<string, [unknown, unknown]>} [diff] changed fields only
 * @property {string} [reason]
 * @property {'general' | 'security' | 'money'} [category]
 * @property {string} [ip]
 * @property {string} [userAgent]
 * @property {string} [requestId]
 */

/**
 * Appends one entry. Pass the caller's transaction so the entry exists if and only if the change committed.
 * @param {import('../../platform/db.js').Executor} tx
 * @param {AuditEntry} e
 * @returns {Promise<string>} the entry id
 */
export async function record(tx, e) {
  const id = uuidv7()
  await tx.insert(auditLog).values({
    id,
    at: now(),
    actorType: e.actor.type,
    actorId: e.actor.id ?? null,
    actorLabel: e.actor.label.slice(0, 120),
    actorRole: e.actor.role ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: cut(e.entityId, 64),
    entityLabel: cut(e.entityLabel, 200),
    diff: redactDiff(e.diff),
    reason: cut(e.reason, 500),
    category: e.category ?? 'general',
    ip: cut(e.ip, 45),
    userAgent: cut(e.userAgent, 300),
    requestId: e.requestId && /^[0-9a-f-]{36}$/.test(e.requestId) ? e.requestId : null,
  })
  return id
}

export { createAuditService, maskIp, summarize } from './service.js'
export { auditHandlers } from './routes.js'

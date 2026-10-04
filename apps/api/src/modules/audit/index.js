// The audit trail (plan/11-security-auth.md section 6): written inside the mutating transaction, never updated or deleted.
// Other modules call only `record()` from here.
import { auditLog } from '../../db/schema/audit.js'
import { now } from '../../platform/clock.js'
import { uuidv7 } from '../../platform/ids.js'

/** Fields whose values never reach the log, whatever module wrote them. */
const SECRET_KEY = /pass(word)?|secret|token|hash|recovery|credential|session|cookie|authorization|account.?number/i

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

/** A value short enough to keep in an audit row: long text is cut, big lists are summarised. @param {unknown} v */
const clip = (v) => {
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…` : v
  if (v && typeof v === 'object' && JSON.stringify(v).length > 1000) return Array.isArray(v) ? `(${v.length} items)` : '(object)'
  return v
}

/**
 * The fields that differ between two documents, by dotted path: `{ 'brand.name': ['Old', 'New'] }`. Objects are compared field by field;
 * lists and other values as a whole. An object that appears or disappears is listed field by field too, so redaction sees every key.
 * @param {unknown} before @param {unknown} after @param {string} [prefix]
 * @returns {Record<string, [unknown, unknown]>}
 */
export function diffOf(before, after, prefix = '') {
  const isObject = (/** @type {unknown} */ x) => x !== null && typeof x === 'object' && !Array.isArray(x)
  const absent = (/** @type {unknown} */ x) => x === undefined || x === null
  if ((isObject(before) || isObject(after)) && (isObject(before) || absent(before)) && (isObject(after) || absent(after))) {
    const a = /** @type {Record<string, unknown>} */ (isObject(before) ? before : {})
    const b = /** @type {Record<string, unknown>} */ (isObject(after) ? after : {})
    return Object.assign({}, ...[...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => diffOf(a[k], b[k], prefix ? `${prefix}.${k}` : k)))
  }
  return JSON.stringify(before) === JSON.stringify(after) ? {} : { [prefix]: [clip(before), clip(after)] }
}

export { createAuditService, maskIp, summarize } from './service.js'
export { auditHandlers } from './routes.js'

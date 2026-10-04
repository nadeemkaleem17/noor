// Events are facts, written in the same transaction as the change (ADR-0009, DOC-08 section 8). A relay turns each event into one job
// per handler. Payloads hold ids and the minimum needed to act, never a copy of the entity and never personal data.
import { and, asc, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import { outboxEvents } from '../db/schema/platform.js'
import { now } from './clock.js'
import { transaction } from './db.js'
import { uuidv7 } from './ids.js'
import { enqueue } from './jobs.js'

/**
 * Writes an event. Pass the caller's transaction so the event exists if and only if the change committed.
 * @param {import('./db.js').Executor} tx
 * @param {{ type: string, payload: Record<string, unknown>, requestId?: string }} event
 * @returns {Promise<string>} the event id
 */
export async function emit(tx, { type, payload, requestId }) {
  const id = uuidv7()
  await tx.insert(outboxEvents).values({ id, type, payload, requestId: requestId ?? null, createdAt: now() })
  return id
}

/** Which job types handle which event type, e.g. `{ 'order.placed': ['notify.customer', 'notify.staff'] }`. */
/** @typedef {Record<string, string[]>} EventHandlers */

/**
 * One relay pass: for up to `limit` unprocessed events (oldest first), enqueue one job per handler with the unique key
 * `event:<eventId>:<jobType>`, then mark the event processed, all in one transaction. A duplicate insert is ignored,
 * so running a pass twice (or from two workers) is safe.
 * @param {import('./db.js').Database['db']} db
 * @param {EventHandlers} handlers
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<number>} events relayed
 */
export function relayOnce(db, handlers, { limit = 100 } = {}) {
  return transaction(db, async (tx) => {
    const events = await tx
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.processedAt))
      .orderBy(asc(outboxEvents.id))
      .limit(limit)
      .for('update', { skipLocked: true })
    const at = now()
    for (const event of events) {
      for (const jobType of handlers[event.type] ?? []) {
        await enqueue(
          tx,
          { type: jobType, payload: { eventId: event.id, type: event.type, payload: event.payload, occurredAt: event.createdAt.toISOString() }, uniqueKey: `event:${event.id}:${jobType}` },
          at,
        )
      }
    }
    if (events.length) await tx.update(outboxEvents).set({ processedAt: at }).where(inArray(outboxEvents.id, events.map((e) => e.id)))
    return events.length
  })
}

/**
 * Deletes processed events older than `days` (job `outbox.cleanup`, daily).
 * @param {import('./db.js').Database['db']} db
 */
export async function cleanupOutbox(db, days = 7) {
  const cutoff = new Date(now().getTime() - days * 86_400_000)
  await db.delete(outboxEvents).where(and(isNotNull(outboxEvents.processedAt), lt(outboxEvents.processedAt, cutoff)))
}

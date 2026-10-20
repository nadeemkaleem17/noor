// What a customer may still ask to return, and what they already asked (plan/10-api/10-returns.md section 2). Pure rules plus one read; the order page and the
// request endpoint both use it, so what the page offers and what the endpoint accepts cannot drift apart.
import { eq, inArray } from 'drizzle-orm'
import { orderLines } from '../../db/schema/orders.js'
import { returnRequestLines, returnRequests } from '../../db/schema/returns.js'

const DAY = 86_400_000
export const returnNumber = (/** @type {number} */ n) => `RR-${String(n).padStart(4, '0')}`
const money = (/** @type {number} */ amount) => ({ amount, currency: /** @type {const} */ ('PKR') })

/**
 * Until when a delivered order may still be returned, or nothing: the shop takes no requests, the order is not delivered, or the days are over.
 * @param {{ status: string, deliveredAt: Date | null }} order @param {number} windowDays @param {Date} at
 */
export function eligibleUntil(order, windowDays, at) {
  if (windowDays <= 0 || order.status !== 'delivered' || !order.deliveredAt) return undefined
  const until = new Date(order.deliveredAt.getTime() + windowDays * DAY)
  return at.getTime() <= until.getTime() ? until : undefined
}

/** A line made to measure or to order is not returnable (the shop's returns page says so). @param {{ customization: unknown }} line */
export const isReturnable = (line) => line.customization == null

/** How many of a line can still be asked for: what was bought, less what already came back or is in a request that was not declined. */
export const returnableOf = (/** @type {{ quantity: number, returnedQuantity: number, customization: unknown }} */ line, /** @type {number} */ asked) =>
  isReturnable(line) ? Math.max(0, line.quantity - line.returnedQuantity - asked) : 0

/** @param {import('../../platform/db.js').Executor} x @param {string} orderId */
export async function requestsOf(x, orderId) {
  const requests = await x.select().from(returnRequests).where(eq(returnRequests.orderId, orderId)).orderBy(returnRequests.requestedAt)
  const rows = requests.length
    ? await x
        .select({ requestId: returnRequestLines.requestId, orderLineId: returnRequestLines.orderLineId, quantity: returnRequestLines.quantity, title: orderLines.title, variantLabel: orderLines.variantLabel })
        .from(returnRequestLines)
        .innerJoin(orderLines, eq(orderLines.id, returnRequestLines.orderLineId))
        .where(inArray(returnRequestLines.requestId, requests.map((r) => r.id)))
    : []
  return { requests, lines: rows }
}

/**
 * The order page's part: the requests made so far, and per line how many can still be asked for. `offer` is absent when the shop takes no requests and none exist.
 * @param {import('../../platform/db.js').Executor} x
 * @param {{ id: string, status: string, deliveredAt: Date | null }} o
 * @param {{ id: string, quantity: number, returnedQuantity: number, customization: unknown }[]} lines
 * @param {number} windowDays @param {Date} at
 */
export async function returnsOffer(x, o, lines, windowDays, at) {
  const { requests, lines: asked } = await requestsOf(x, o.id)
  /** @type {Map<string, number>} */
  const reserved = new Map()
  for (const r of requests) if (r.status !== 'declined') for (const l of asked.filter((a) => a.requestId === r.id)) reserved.set(l.orderLineId, (reserved.get(l.orderLineId) ?? 0) + l.quantity)
  const until = eligibleUntil(o, windowDays, at)
  const returnable = new Map(lines.map((l) => [l.id, until ? returnableOf(l, reserved.get(l.id) ?? 0) : 0]))
  const open = until && [...returnable.values()].some((n) => n > 0)
  if (windowDays <= 0 && requests.length === 0) return { returnable, offer: undefined }
  return {
    returnable,
    offer: {
      windowDays,
      ...(open ? { eligibleUntil: until.toISOString() } : {}),
      requests: requests.map((r) => ({
        number: returnNumber(r.number), kind: r.kind, status: r.status, reason: r.reason, requestedAt: r.requestedAt.toISOString(),
        lines: asked.filter((a) => a.requestId === r.id).map((a) => ({ title: a.title, variantLabel: a.variantLabel, quantity: a.quantity })),
        ...(r.decisionNote ? { decisionNote: r.decisionNote } : {}), ...(r.pickupOn ? { pickupOn: r.pickupOn } : {}), ...(r.refundMinor != null ? { refund: money(r.refundMinor) } : {}),
      })),
    },
  }
}

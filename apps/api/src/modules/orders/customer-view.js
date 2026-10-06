// What the customers module needs to know about orders (its `OrdersView`): whether one is still open, the addresses used, and the removal of personal data
// when a customer is anonymised (plan/11-security-auth.md section 8.2). Queries take the caller's executor, so they run inside its transaction.
import { and, desc, eq, inArray, max, notInArray, sql } from 'drizzle-orm'
import { customers } from '../../db/schema/customers.js'
import { notificationLog } from '../../db/schema/notifications.js'
import { orders } from '../../db/schema/orders.js'

/** An order is settled when nothing more will happen to it but a return: its personal data may go. */
const settled = ['delivered', 'cancelled', 'returned']

/** @type {import('../customers/service.js').OrdersView} */
export const customerOrders = {
  async openCount(db, customerId) {
    const [r] = await db.select({ n: sql`count(*)`.mapWith(Number) }).from(orders).where(and(eq(orders.customerId, customerId), notInArray(orders.status, settled)))
    return r?.n ?? 0
  },

  async addresses(db, customerId) {
    const rows = await db
      .select({ city: orders.shipCity, address: orders.shipAddress, landmark: orders.shipLandmark, lastUsedAt: max(orders.placedAt) })
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .groupBy(orders.shipCity, orders.shipAddress, orders.shipLandmark)
      .orderBy(desc(max(orders.placedAt)))
      .limit(5)
    return rows.map((r) => ({ city: r.city, address: r.address, ...(r.landmark ? { landmark: r.landmark } : {}), lastUsedAt: /** @type {Date} */ (r.lastUsedAt).toISOString() }))
  },

  /** The customer row already holds its placeholder phone: the orders get the same one, and the messages kept for those orders lose their recipient and text. */
  async anonymise(db, customerId) {
    const [c] = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, customerId))
    const mine = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.customerId, customerId), inArray(orders.status, settled)))
    if (!c || !mine.length) return
    const ids = mine.map((o) => o.id)
    await db.update(orders).set({ customerName: 'Removed customer', customerPhone: c.phone, customerEmail: null, shipAddress: '(removed)', shipLandmark: null, shipNotes: null, customFields: null }).where(inArray(orders.id, ids))
    await db.update(notificationLog).set({ recipient: '(removed)', body: '(removed)' }).where(inArray(notificationLog.orderId, ids))
  },
}

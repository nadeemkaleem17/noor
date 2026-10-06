// The background work of payments and unpaid orders. `orders` is the orders service: a payment that completes an order confirms it, and an order nobody paid for is cancelled.

/**
 * @param {{ applyPaymentEvent: (eventId: string) => Promise<unknown>, expireUnpaid: () => Promise<unknown> }} orders
 * @returns {Record<string, (ctx: { job: { payload: any } }) => Promise<void>>}
 */
export const paymentJobs = (orders) => ({
  'payments.apply_event': async ({ job }) => void (await orders.applyPaymentEvent(job.payload.eventId)),
  'orders.expire_unpaid': async () => void (await orders.expireUnpaid()),
})

import { createNotifications } from './service.js'

export { createNotifications }
export { createMailer } from './mailer.js'

/** The events that make the order messages, all handled by one job. */
export const notificationEvents = Object.fromEntries(['order.placed', 'order.confirmed', 'order.dispatched', 'order.delivered', 'order.cancelled', 'order.returned'].map((e) => [e, ['notify.order']]))

/**
 * @param {ReturnType<typeof createNotifications>} n
 * @returns {Record<string, (ctx: { job: { payload: any } }) => Promise<void>>}
 */
export const notificationJobs = (n) => ({
  // the payload is what the relay writes: the event's type and its own payload
  'notify.order': async ({ job }) => void (await n.forOrder(job.payload.type, job.payload.payload.orderId)),
  'notifications.cleanup': async () => void (await n.cleanup()),
})

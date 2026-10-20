// Handlers for the delivery routes of the contract (plan/18-delivery-assignment-ledger-receipts.md section 7).
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createDeliveryService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function deliveryHandlers(s) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })
  return {
    'admin.delivery.people.list': async () => s.listPeople(),
    'admin.delivery.people.create': async ({ actor, body, http, requestId }) => s.createPerson(staff(actor), body, info(http, requestId)),
    'admin.delivery.people.update': async ({ actor, params, body, http, requestId }) => s.updatePerson(staff(actor), params.id, body, info(http, requestId)),
    'admin.delivery.assign': async ({ actor, body, http, requestId }) => s.assign(staff(actor), body, info(http, requestId)),
    'admin.delivery.runs.list': async ({ query }) => s.listRuns(query),
    'admin.delivery.runs.get': async ({ params }) => s.getRun(params.id),
    'admin.delivery.runs.sendOut': async ({ actor, params, http, requestId }) => s.sendOut(staff(actor), params.id, info(http, requestId)),
    'admin.delivery.runs.close': async ({ actor, params, http, requestId }) => s.close(staff(actor), params.id, info(http, requestId)),
    'admin.delivery.assignments.deliver': async ({ actor, params, http, requestId }) => s.deliver(staff(actor), params.id, info(http, requestId)),
    'admin.delivery.assignments.fail': async ({ actor, params, body, http, requestId }) => s.fail(staff(actor), params.id, body.reason, info(http, requestId)),
    'admin.delivery.assignments.return': async ({ actor, params, http, requestId }) => s.returnToShop(staff(actor), params.id, info(http, requestId)),
    'admin.delivery.assignments.remove': async ({ actor, params, http, requestId }) => s.remove(staff(actor), params.id, info(http, requestId)),
    'admin.delivery.ledger.statement': async ({ params, query }) => s.statement(params.id, query),
    'admin.delivery.ledger.deposit': async ({ actor, params, body, http, requestId }) => s.deposit(staff(actor), params.id, body, info(http, requestId)),
    'admin.delivery.ledger.payFee': async ({ actor, params, body, http, requestId }) => s.payFee(staff(actor), params.id, body, info(http, requestId)),
    'admin.delivery.ledger.adjust': async ({ actor, params, body, http, requestId }) => s.adjust(staff(actor), params.id, body, info(http, requestId)),
    'admin.delivery.receipts.list': async ({ query }) => s.listReceipts(query),
    'admin.delivery.receipts.get': async ({ params }) => s.getReceipt(params.id),
    'admin.delivery.receipts.void': async ({ actor, params, body, http, requestId }) => s.voidReceipt(staff(actor), params.id, body.reason, info(http, requestId)),
    'admin.orders.delivery': async ({ params }) => s.ofOrder(params.id),
  }
}

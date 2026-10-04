// Handlers for the shipping routes of the contract (plan/10-api/07 section 5, plan/10-api/01 `shipping.listCities`).
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createShippingService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function shippingHandlers(s) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    'shipping.listCities': async () => s.publicCities(),
    'admin.shipping.listZones': async () => s.listZones(),
    'admin.shipping.createZone': async ({ actor, body, http, requestId }) => s.createZone(staff(actor), body, info(http, requestId)),
    'admin.shipping.updateZone': async ({ actor, params, body, http, requestId }) => s.updateZone(staff(actor), params.id, body, info(http, requestId)),
    'admin.shipping.deleteZone': async ({ actor, params, http, requestId }) => {
      await s.deleteZone(staff(actor), params.id, info(http, requestId))
    },
    'admin.shipping.zoneImpact': async ({ params, body }) => s.zoneImpact(params.id, body),
    'admin.shipping.listCities': async ({ query }) => s.listCities({ ...query, unassigned: query.unassigned }),
    'admin.shipping.createCity': async ({ actor, body, http, requestId }) => s.createCity(staff(actor), body, info(http, requestId)),
    'admin.shipping.updateCity': async ({ actor, params, body, http, requestId }) => s.updateCity(staff(actor), params.id, body, info(http, requestId)),
    'admin.shipping.matchCities': async ({ body }) => s.matchCities(body.names),
    'admin.couriers.list': async () => s.listCouriers(),
    'admin.couriers.create': async ({ actor, body, http, requestId }) => s.createCourier(staff(actor), body, info(http, requestId)),
    'admin.couriers.update': async ({ actor, params, body, http, requestId }) => s.updateCourier(staff(actor), params.id, body, info(http, requestId)),
  }
}

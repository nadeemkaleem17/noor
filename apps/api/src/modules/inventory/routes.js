// Handlers for the inventory routes of the contract (plan/10-api/05 section 4).
/**
 * @param {ReturnType<typeof import('./service.js').createInventory>} inventory
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function inventoryHandlers(inventory) {
  return {
    'admin.inventory.adjust': async ({ actor, body, http, requestId }) =>
      inventory.adjustByStaff(/** @type {import('./service.js').Staff} */ (actor), body, { ip: http.ip, userAgent: http.userAgent, requestId }),
    'admin.inventory.listMovements': async ({ query }) => inventory.listMovements(query),
  }
}

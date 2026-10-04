// Handlers for the catalog structure routes of the contract (plan/10-api/05 sections 5 and 7).
const staff = (/** @type {unknown} */ actor) => /** @type {import('./common.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createCatalogService>} catalog
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function catalogHandlers({ categories, attributes, sizes }) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    'admin.categories.list': async () => categories.list(),
    'admin.categories.create': async ({ actor, body, http, requestId }) => categories.create(staff(actor), body, info(http, requestId)),
    'admin.categories.reorder': async ({ actor, body, http, requestId }) => {
      await categories.reorder(staff(actor), body, info(http, requestId))
    },
    'admin.categories.update': async ({ actor, params, body, http, requestId }) => categories.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.categories.delete': async ({ actor, params, http, requestId }) => {
      await categories.remove(staff(actor), params.id, info(http, requestId))
    },

    'admin.attributes.list': async () => attributes.list(),
    'admin.attributes.create': async ({ actor, body, http, requestId }) => attributes.create(staff(actor), body, info(http, requestId)),
    'admin.attributes.update': async ({ actor, params, body, http, requestId }) => attributes.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.attributes.mergeValue': async ({ actor, params, body, http, requestId }) => {
      await attributes.mergeValue(staff(actor), params.id, params.valueId, body.intoValueId, info(http, requestId))
    },
    'admin.attributes.delete': async ({ actor, params, http, requestId }) => {
      await attributes.remove(staff(actor), params.id, info(http, requestId))
    },

    'admin.sizeSystems.list': async () => sizes.list(),
    'admin.sizeSystems.create': async ({ actor, body, http, requestId }) => sizes.createSystem(staff(actor), body, info(http, requestId)),
    'admin.sizeSystems.update': async ({ actor, params, body, http, requestId }) => sizes.updateSystem(staff(actor), params.id, body, info(http, requestId)),
    'admin.sizeSystems.delete': async ({ actor, params, http, requestId }) => {
      await sizes.removeSystem(staff(actor), params.id, info(http, requestId))
    },

    'admin.sizeCharts.list': async () => sizes.listCharts(),
    'admin.sizeCharts.get': async ({ params }) => sizes.getChart(params.id),
    'admin.sizeCharts.create': async ({ actor, body, http, requestId }) => sizes.createChart(staff(actor), body, info(http, requestId)),
    'admin.sizeCharts.update': async ({ actor, params, body, http, requestId }) => sizes.updateChart(staff(actor), params.id, body, info(http, requestId)),
    'admin.sizeCharts.delete': async ({ actor, params, http, requestId }) => {
      await sizes.removeChart(staff(actor), params.id, info(http, requestId))
    },

    'admin.formSchemas.list': async () => sizes.listForms(),
    'admin.formSchemas.get': async ({ params }) => sizes.getForm(params.id),
    'admin.formSchemas.create': async ({ actor, body, http, requestId }) => sizes.createForm(staff(actor), body, info(http, requestId)),
    'admin.formSchemas.update': async ({ actor, params, body, http, requestId }) => sizes.updateForm(staff(actor), params.id, body, info(http, requestId)),
    'admin.formSchemas.delete': async ({ actor, params, http, requestId }) => {
      await sizes.removeForm(staff(actor), params.id, info(http, requestId))
    },
  }
}

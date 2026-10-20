// Handlers for the catalog routes of the contract: admin (plan/10-api/05) and public (plan/10-api/02).
import { eachOf } from '../../platform/bulk.js'
import { publicCatalogHandlers } from './public-routes.js'


const staff = (/** @type {unknown} */ actor) => /** @type {import('./common.js').Staff} */ (actor)
/** The signed-in staff member, with whether they may publish (products:publish). */
const publisher = (/** @type {unknown} */ actor) => ({ ...staff(actor), canPublish: /** @type {{ permissions: ReadonlySet<string> }} */ (actor).permissions.has('products:publish') })

/**
 * @param {ReturnType<typeof import('./service.js').createCatalogService>} catalog
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function catalogHandlers({ categories, attributes, sizes, products, collections, listing, public: pub }) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    ...publicCatalogHandlers(pub, listing),
    'admin.categories.list': async () => categories.list(),
    'admin.categories.create': async ({ actor, body, http, requestId }) => categories.create(staff(actor), body, info(http, requestId)),
    'admin.categories.reorder': async ({ actor, body, http, requestId }) => {
      await categories.reorder(staff(actor), body, info(http, requestId))
    },
    'admin.categories.update': async ({ actor, params, body, http, requestId }) => categories.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.categories.delete': async ({ actor, params, http, requestId }) => {
      await categories.remove(staff(actor), params.id, info(http, requestId))
    },
    'admin.categories.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => categories.remove(staff(actor), id, info(http, requestId))),

    'admin.attributes.list': async () => attributes.list(),
    'admin.attributes.create': async ({ actor, body, http, requestId }) => attributes.create(staff(actor), body, info(http, requestId)),
    'admin.attributes.update': async ({ actor, params, body, http, requestId }) => attributes.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.attributes.mergeValue': async ({ actor, params, body, http, requestId }) => {
      await attributes.mergeValue(staff(actor), params.id, params.valueId, body.intoValueId, info(http, requestId))
    },
    'admin.attributes.delete': async ({ actor, params, http, requestId }) => {
      await attributes.remove(staff(actor), params.id, info(http, requestId))
    },
    'admin.attributes.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => attributes.remove(staff(actor), id, info(http, requestId))),

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
    'admin.sizeCharts.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => sizes.removeChart(staff(actor), id, info(http, requestId))),

    'admin.formSchemas.list': async () => sizes.listForms(),
    'admin.formSchemas.get': async ({ params }) => sizes.getForm(params.id),
    'admin.formSchemas.create': async ({ actor, body, http, requestId }) => sizes.createForm(staff(actor), body, info(http, requestId)),
    'admin.formSchemas.update': async ({ actor, params, body, http, requestId }) => sizes.updateForm(staff(actor), params.id, body, info(http, requestId)),
    'admin.formSchemas.delete': async ({ actor, params, http, requestId }) => {
      await sizes.removeForm(staff(actor), params.id, info(http, requestId))
    },

    'admin.products.list': async ({ query }) => products.list(query),
    'admin.products.checkSku': async ({ query }) => products.skuAvailable(query.sku, query.exceptVariantId),
    'admin.products.checks': async ({ body }) => products.checks(body),
    'admin.products.get': async ({ params }) => products.get(params.id),
    'admin.products.create': async ({ actor, body, http, requestId }) => products.save(publisher(actor), null, body, info(http, requestId)),
    'admin.products.update': async ({ actor, params, body, http, requestId }) => products.save(publisher(actor), params.id, body, info(http, requestId)),
    'admin.products.delete': async ({ actor, params, http, requestId }) => {
      await products.remove(staff(actor), params.id, info(http, requestId))
    },
    'admin.products.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => products.remove(staff(actor), id, info(http, requestId))),
    'admin.products.duplicate': async ({ actor, params, http, requestId }) => products.duplicate(publisher(actor), params.id, info(http, requestId)),
    'admin.products.bulk': async ({ actor, body, http, requestId }) => products.bulk(staff(actor), body.ids, body.action, info(http, requestId)),
    'admin.products.previewLink': async ({ params }) => products.previewLink(params.id),

    'admin.collections.list': async ({ query }) => collections.list(query),
    'admin.collections.get': async ({ params }) => collections.get(params.id),
    'admin.collections.create': async ({ actor, body, http, requestId }) => collections.create(staff(actor), body, info(http, requestId)),
    'admin.collections.update': async ({ actor, params, body, http, requestId }) => collections.update(staff(actor), params.id, body, info(http, requestId)),
    'admin.collections.delete': async ({ actor, params, http, requestId }) => {
      await collections.remove(staff(actor), params.id, info(http, requestId))
    },
    'admin.collections.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => collections.remove(staff(actor), id, info(http, requestId))),
  }
}

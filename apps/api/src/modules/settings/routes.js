// Handlers for the settings, content and public store routes of the contract.
import { eachOf } from '../../platform/bulk.js'
const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createSettingsService>} s
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export function settingsHandlers(s) {
  /** @param {{ ip: string, userAgent: string }} http @param {string} requestId */
  const info = (http, requestId) => ({ ip: http.ip, userAgent: http.userAgent, requestId })

  return {
    'admin.settings.getStore': async () => s.get('store'),
    'admin.settings.updateStore': async ({ actor, body, http, requestId }) => s.save(staff(actor), 'store', body, info(http, requestId)),
    'admin.settings.getTheme': async () => s.get('theme'),
    'admin.settings.updateTheme': async ({ actor, body, http, requestId }) => s.save(staff(actor), 'theme', body, info(http, requestId)),
    'admin.settings.getCheckout': async () => s.get('checkout'),
    'admin.settings.updateCheckout': async ({ actor, body, http, requestId }) => s.save(staff(actor), 'checkout', body, info(http, requestId)),
    'admin.settings.getPayments': async () => s.getPayments(),
    'admin.settings.updatePayments': async ({ actor, body, http, requestId }) => s.savePayments(staff(actor), body, info(http, requestId)),
    'admin.content.getHome': async () => s.get('home'),
    'admin.content.updateHome': async ({ actor, body, http, requestId }) => s.save(staff(actor), 'home', body, info(http, requestId)),
    'admin.settings.themePresets': async () => s.themePresets(),
    'admin.settings.translationStatus': async () => s.translationStatus(),

    'admin.pages.list': async ({ query }) => s.listPages(query),
    'admin.pages.preview': async ({ body }) => s.previewPage(body.bodyMd),
    'admin.pages.get': async ({ params }) => s.getPage(params.id),
    'admin.pages.create': async ({ actor, body, http, requestId }) => s.createPage(staff(actor), body, info(http, requestId)),
    'admin.pages.update': async ({ actor, params, body, http, requestId }) => s.updatePage(staff(actor), params.id, body, info(http, requestId)),
    'admin.pages.delete': async ({ actor, params, http, requestId }) => {
      await s.deletePage(staff(actor), params.id, info(http, requestId))
    },
    'admin.pages.bulkDelete': async ({ actor, body, http, requestId }) => eachOf(body.ids, (id) => s.deletePage(staff(actor), id, info(http, requestId))),
    'admin.menus.get': async ({ params }) => s.getMenu(params.handle),
    'admin.menus.update': async ({ actor, params, body, http, requestId }) => s.saveMenu(staff(actor), params.handle, body, info(http, requestId)),
    'admin.links.search': async ({ query }) => s.searchLinks(query.q),

    'store.getConfig': async () => s.storeConfig(),
    'content.getHome': async ({ query }) => s.home(query.locale),
    'content.getMenu': async ({ params, query }) => s.menu(params.handle, query.locale),
    'content.getPage': async ({ params, query }) => s.page(params.slug, query.locale),
    'content.listPages': async () => s.listPublicPages(),
  }
}

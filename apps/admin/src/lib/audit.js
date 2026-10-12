// How an audit entry reads and where it points (plan/07-admin/13-audit-log.md sections 2 and 3). Shared by the audit screen and the History panels.

const words = (/** @type {string} */ code) => code.replace(/_/g, ' ')

/** Sentences for the codes whose plain "<verb> <thing>" reading would be odd. */
const sentences = /** @type {Record<string, string>} */ ({
  'auth.login': 'signed in',
  'auth.login_failed': 'failed sign-in',
  'auth.logout': 'signed out',
  'auth.locked': 'account locked after wrong passwords',
  'auth.password_changed': 'changed their password',
  'auth.password_reset': 'reset a password with a link',
  'auth.recovery_codes_regenerated': 'made new recovery codes',
  'auth.session_revoked': 'ended a session',
  'auth.sessions_revoked': 'ended sessions',
  'staff.invited': 'invited staff',
  'staff.invite_accepted': 'accepted an invite',
  'staff.invite_resent': 'resent an invite',
  'staff.password_reset_issued': 'issued a password reset',
  'staff.sessions_revoked': 'signed staff out everywhere',
  'staff.profile_updated': 'updated a profile',
  'staff.owner_created': 'created the owner',
  'attribute.value_merged': 'merged attribute values',
  'inventory.adjusted': 'adjusted stock',
  'category.reordered': 'reordered categories',
  'auth.login_2fa': 'signed in with a code',
  'auth.login_recovery_code': 'signed in with a recovery code',
  'auth.2fa_failed': 'entered a wrong code',
  'auth.2fa_enabled': 'turned on two-step sign-in',
  'auth.2fa_disabled': 'turned off two-step sign-in',
  'staff.2fa_reset': 'reset two-step sign-in',
  'staff.role_changed': 'changed a role',
  'staff.updated': 'updated staff',
  'shipping.zone_created': 'created a shipping zone',
  'shipping.zone_updated': 'updated a shipping zone',
  'shipping.city_created': 'added a city',
  'shipping.city_updated': 'updated a city',
  'shipping.zone_deleted': 'deleted a shipping zone',
})

/** "updated product" from `product.updated`. @param {string} action */
export function actionSentence(action) {
  if (sentences[action]) return sentences[action]
  const [thing = action, verb] = action.split('.')
  return verb ? `${words(verb)} ${words(thing)}` : words(action)
}

/** The admin screen for an entity, when there is one. @param {string} type @param {string | undefined} id */
export function entityHref(type, id) {
  if (!id) return undefined
  const to = /** @type {Record<string, string>} */ ({
    product: `/products/${id}`,
    customer: id === 'export' ? undefined : `/customers/${id}`,
    order: `/orders/${id}`,
    staff: `/staff/${id}`,
    collection: `/collections/${id}`,
    page: `/content/pages/${id}`,
    settings: id === 'theme' ? '/settings/appearance' : id === 'payments' ? '/settings/payments' : '/settings/store',
    shipping_zone: '/settings/shipping',
    city: '/settings/shipping',
    courier: '/settings/shipping',
    category: '/categories',
    attribute: '/attributes',
    size_system: '/sizes',
    size_chart: '/sizes',
    menu: '/content/menus',
    content: '/content/home',
  })
  return to[type]
}

/** The types the filter offers: what the server writes today. */
export const entityTypes = ['product', 'variant', 'category', 'collection', 'attribute', 'size_system', 'size_chart', 'form_schema', 'page', 'menu', 'content', 'settings', 'shipping_zone', 'city', 'courier', 'media', 'staff']
export const entityTypeLabel = (/** @type {string} */ type) => words(type).replace(/^./, (c) => c.toUpperCase())

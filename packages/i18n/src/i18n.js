// One i18next instance per request on the server, one per page on the client (plan/03 section 9; the M0-I18N-SPIKE fallback).
// Both catalogs are bundled; ponytail: split by locale with dynamic import once `ur` is large.
import i18next from 'i18next'
import { LiteICU } from './icu-lite.js'
import { defaultLocale } from './locale.js'
import enCommon from '../locales/en/common.json' with { type: 'json' }
import enErrors from '../locales/en/errors.json' with { type: 'json' }
import enNotifications from '../locales/en/notifications.json' with { type: 'json' }
import enStorefront from '../locales/en/storefront.json' with { type: 'json' }
import urCommon from '../locales/ur/common.json' with { type: 'json' }
import urErrors from '../locales/ur/errors.json' with { type: 'json' }
import urNotifications from '../locales/ur/notifications.json' with { type: 'json' }
import urStorefront from '../locales/ur/storefront.json' with { type: 'json' }

export const namespaces = /** @type {const} */ (['common', 'storefront', 'errors', 'notifications'])

const resources = {
  en: { common: enCommon, storefront: enStorefront, errors: enErrors, notifications: enNotifications },
  ur: { common: urCommon, storefront: urStorefront, errors: urErrors, notifications: urNotifications },
}

/**
 * Synchronous, so it works during server rendering. A key missing in `ur` falls back to `en`.
 * @param {import('./locale.js').Locale} locale
 * @returns {import('i18next').i18n}
 */
export function createI18n(locale) {
  const instance = i18next.createInstance()
  void instance.use(new LiteICU()).init({
    lng: locale,
    fallbackLng: defaultLocale,
    ns: [...namespaces],
    defaultNS: 'common',
    resources,
    interpolation: { escapeValue: false }, // React escapes
    initAsync: false,
  })
  return instance
}

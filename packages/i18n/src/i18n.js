// One i18next instance per request on the server, one per page on the client (plan/03 section 9; the M0-I18N-SPIKE fallback).
// Both catalogs are bundled; ponytail: split by locale with dynamic import once `ur` is large.
import i18next from 'i18next'
import ICU from 'i18next-icu'
import { defaultLocale } from './locale.js'
import enCommon from '../locales/en/common.json'
import enErrors from '../locales/en/errors.json'
import enStorefront from '../locales/en/storefront.json'
import urCommon from '../locales/ur/common.json'
import urErrors from '../locales/ur/errors.json'
import urStorefront from '../locales/ur/storefront.json'

export const namespaces = /** @type {const} */ (['common', 'storefront', 'errors'])

const resources = {
  en: { common: enCommon, storefront: enStorefront, errors: enErrors },
  ur: { common: urCommon, storefront: urStorefront, errors: urErrors },
}

/**
 * Synchronous, so it works during server rendering. A key missing in `ur` falls back to `en`.
 * @param {import('./locale.js').Locale} locale
 * @returns {import('i18next').i18n}
 */
export function createI18n(locale) {
  const instance = i18next.createInstance()
  void instance.use(new ICU()).init({
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

// One i18next instance per request on the server, one per page on the client (plan/03 section 9; the M0-I18N-SPIKE fallback).
// Both catalogs are bundled; ponytail: split by locale with dynamic import once `ur` is large.
import i18next, { type i18n } from 'i18next'
import ICU from 'i18next-icu'
import { defaultLocale, type Locale } from './locale'
import enCommon from '../locales/en/common.json'
import enErrors from '../locales/en/errors.json'
import enStorefront from '../locales/en/storefront.json'
import urCommon from '../locales/ur/common.json'
import urErrors from '../locales/ur/errors.json'
import urStorefront from '../locales/ur/storefront.json'

export const namespaces = ['common', 'storefront', 'errors'] as const

const resources = {
  en: { common: enCommon, storefront: enStorefront, errors: enErrors },
  ur: { common: urCommon, storefront: urStorefront, errors: urErrors },
}

/** Synchronous, so it works during server rendering. A key missing in `ur` falls back to `en`. */
export function createI18n(locale: Locale): i18n {
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

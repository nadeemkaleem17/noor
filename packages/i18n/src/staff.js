// The staff admin is English only (ADR-0018) and needs no plural or select messages, so its i18next instance is the plain one:
// no ICU parser, no Urdu or storefront catalogs. @noor/ui components read their labels from `common` and `errors`.
import i18next from 'i18next'
import enCommon from '../locales/en/common.json' with { type: 'json' }
import enErrors from '../locales/en/errors.json' with { type: 'json' }

export function createStaffI18n() {
  const instance = i18next.createInstance()
  void instance.init({
    lng: 'en',
    ns: ['common', 'errors'],
    defaultNS: 'common',
    resources: { en: { common: enCommon, errors: enErrors } },
    // {name} placeholders, as in the ICU catalogs; common.json and errors.json use nothing beyond that
    interpolation: { prefix: '{', suffix: '}', escapeValue: false },
    initAsync: false,
  })
  return instance
}

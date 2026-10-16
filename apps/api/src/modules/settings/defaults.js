// What each settings document holds before anyone saves it (plan/09-data-model/09 section 2.1, "Seed values"). A document that was
// never saved reads as its default with version 0, so the store works on an empty database.
import { themePresets } from '@noor/contract'

/** @type {{ store: import('@noor/contract').StoreSettings, theme: import('@noor/contract').ThemeTokens, home: import('@noor/contract').HomeContent, payments: import('@noor/contract').PaymentSettings, checkout: import('@noor/contract').CheckoutSettings }} */
export const defaults = {
  store: {
    brand: { name: 'Rubaya' },
    contact: { socials: [] },
    priceDisplay: { showDecimals: false, rounding: 'none' },
    orderNumberPrefix: 'RB',
    locale: { default: 'en', supported: ['en'] },
    features: { wishlist: true, reviews: true, notifyMe: true, customSizing: false },
    navigation: { mode: 'automatic' },
    popularSearches: [],
    policies: {},
    seo: {},
    notifications: { staffEmails: [] },
    thresholds: { lowStock: 3, highValueCodMinor: 2_500_000 },
  },
  theme: themePresets.atelier,
  home: {
    announcement: { text: '' },
    notices: [],
    heroSlides: [],
    promo: { enabled: false },
    editorial: { enabled: false },
    footer: { about: '' },
  },
  payments: { methods: [{ type: 'cod', enabled: true, label: 'Cash on delivery', sortOrder: 0 }] },
  checkout: { extraFields: [], marketingConsent: { enabled: false, label: '' } },
}

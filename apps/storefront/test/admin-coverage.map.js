// What a customer sees of everything staff can edit (plan/06-storefront/12-admin-coverage.md). One line per field of the schemas the admin saves:
//   [status, needle, note]
//   shown       a customer sees it; `needle` is a text the shop's code must contain (a field it reads)
//   partly      shown, but not where or as completely as it should be; `note` names the task that finishes it
//   not-shown   staff can set it and no customer ever sees it (a dead control); `needle` must NOT be in the shop's code, and the test fails the day it is,
//               so that whoever fixes it flips the line to `shown`; `note` names the task that fixes it
//   staff-only  not for customers, by design; `note` says why
// A field of a schema with no line here fails the test: a new admin setting has to decide where the shop shows it.
// (needles are checked in apps/storefront/app and packages/ui/src, which builds the theme's CSS)

const urdu = ['staff-only', null, 'Urdu is switched off (owner decision 2026-10-15)']
/** @param {string} why */
const api = (why) => ['staff-only', null, why]

export const storeSettings = {
  'brand.name': ['shown', 'brand.name'],
  'brand.tagline': ['partly', 'tagline', 'page title only; shown under the logo and in the footer in M8-03'],
  'brand.logoLightMediaId': ['shown', 'logoLight'],
  'brand.logoDarkMediaId': ['not-shown', 'logoDark', 'M8-03 and M8-09: used by the see-through header and a dark footer (there is no dark surface yet)'],
  'brand.faviconMediaId': ['shown', 'brand.favicon'],
  'contact.whatsapp': ['shown', 'whatsapp'],
  'contact.phone': ['shown', 'contact.phone'],
  'contact.email': ['shown', 'contact.email'],
  'contact.address': ['shown', 'contact.address'],
  'contact.mapUrl': ['shown', 'mapUrl'],
  'contact.hours': ['shown', 'hours'],
  'contact.socials[].platform': ['shown', 'socials'],
  'contact.socials[].url': ['shown', 'socials'],
  'priceDisplay.showDecimals': ['shown', 'priceDisplay'],
  'priceDisplay.rounding': ['shown', 'priceDisplay'],
  orderNumberPrefix: api('the API writes the order numbers; the shop shows them as given'),
  'locale.default': ['shown', 'locale'],
  'locale.supported[]': ['shown', 'supported'],
  'features.wishlist': ['shown', 'features.wishlist'],
  'features.reviews': ['shown', 'features.reviews'],
  'features.notifyMe': ['shown', 'features.notifyMe'],
  'features.customSizing': ['shown', 'features.customSizing'],
  'features.visitTracking': ['shown', 'visitTracking'],
  'popularSearches[]': ['shown', 'popularSearches'],
  'navigation.mode': ['shown', 'navigation'],
  'navigation.showEmptyCategories': ['shown', 'navigation'],
  'policies.returnsDays': ['shown', 'returnsDays'],
  'policies.returns': ['not-shown', 'policies.returns', 'M8-06: the "Delivery and returns" section of the product page'],
  'policies.shipping': ['not-shown', 'policies.shipping', 'M8-06: the same section and the shipping page'],
  'policies.privacy': ['not-shown', 'policies.privacy', 'M8-12: the footer line and the privacy page'],
  'policies.terms': ['not-shown', 'policies.terms', 'M8-12: the footer line and the terms page'],
  'seo.homeDescription': ['shown', 'homeDescription'],
  'notifications.staffEmails[]': api('addresses of staff who get order mail'),
  'thresholds.lowStock': api('the API derives "low stock" from it; the shop shows the result'),
  'thresholds.highValueCodMinor': api('the API flags high-value cash on delivery orders; the shop shows the message'),
  dispatchPromise: ['partly', 'dispatchPromise', 'on the product page; the bag and the checkout in M8-07'],
}

export const homeContent = {
  'announcement.text': ['shown', 'announcement'],
  'announcement.href': ['shown', 'announcement'],
  'notices[].id': ['shown', 'notices'],
  'notices[].text': ['shown', 'notices'],
  'notices[].href': ['shown', 'notices'],
  'notices[].severity': ['not-shown', 'severity', 'M8-03: a notice is styled by its severity (info, promo, notice)'],
  'notices[].startsAt': ['shown', 'notices'],
  'notices[].endsAt': ['shown', 'notices'],
  'heroSlides[].id': ['shown', 'heroSlides'],
  'heroSlides[].mediaId': ['shown', 'heroSlides'],
  'heroSlides[].alt': ['shown', 'heroSlides'],
  'heroSlides[].heading': ['shown', 'heroSlides'],
  'heroSlides[].subheading': ['shown', 'subheading'],
  'heroSlides[].buttonText': ['shown', 'buttonText'],
  'heroSlides[].buttonHref': ['shown', 'buttonHref'],
  'promo.enabled': ['shown', 'promo'],
  'promo.eyebrow': ['shown', 'eyebrow'],
  'promo.heading': ['shown', 'promo'],
  'promo.text': ['shown', 'promo'],
  'promo.buttonText': ['shown', 'buttonText'],
  'promo.buttonHref': ['shown', 'buttonHref'],
  'editorial.enabled': ['shown', 'editorial'],
  'editorial.mediaId': ['shown', 'editorial'],
  'editorial.alt': ['shown', 'editorial'],
  'editorial.eyebrow': ['shown', 'eyebrow'],
  'editorial.heading': ['shown', 'editorial'],
  'editorial.text': ['shown', 'editorial'],
  'editorial.buttonText': ['shown', 'buttonText'],
  'editorial.buttonHref': ['shown', 'buttonHref'],
  'footer.about': ['shown', 'footer'],
}

export const themeTokens = {
  preset: ['shown', 'theme'],
  'colors.bg': ['shown', 'theme'],
  'colors.surface': ['shown', 'theme'],
  'colors.fg': ['shown', 'theme'],
  'colors.muted': ['shown', 'theme'],
  'colors.line': ['shown', 'theme'],
  'colors.accent': ['shown', 'theme'],
  'colors.onAccent': ['shown', 'theme'],
  'colors.sale': ['shown', 'theme'],
  'colors.success': ['shown', 'theme'],
  'colors.warning': ['shown', 'theme'],
  'colors.danger': ['shown', 'theme'],
  'colors.focus': ['shown', 'theme'],
  'colors.surface2': ['shown', 'theme'],
  'colors.fgSoft': ['shown', 'theme'],
  'colors.lineStrong': ['shown', 'theme'],
  'colors.accentText': ['shown', 'theme'],
  'colors.accentSoft': ['shown', 'theme'],
  'fonts.heading': ['shown', 'fonts'],
  'fonts.body': ['shown', 'fonts'],
  'radius.control': ['shown', 'radius'],
  'radius.card': ['shown', 'radius'],
  'radius.media': ['shown', 'radius'],
  density: ['shown', 'density'],
  mediaRatio: ['shown', 'mediaRatio'],
  'header.layout': ['shown', 'header.layout'],
  'header.sticky': ['shown', 'header.sticky'],
}

export const categoryInput = {
  name: ['shown', 'name'],
  handle: ['shown', 'handle'],
  parentId: ['shown', 'breadcrumb'],
  description: ['shown', 'description'],
  imageMediaId: ['partly', 'image', 'home tiles and meta only; menu panel, landing page and circles in M8-02, M8-03, M8-05'],
  visible: api('hidden categories are not in the public tree at all'),
  'attributes[].attributeId': ['shown', 'facets'],
  'attributes[].seoIndexable': ['shown', 'listingIndex'],
  'attributes[].required': api('a rule for the product editor'),
  'seo.title': ['shown', 'seo'],
  'seo.description': ['shown', 'seo'],
  'i18n.ur.name': urdu,
  'i18n.ur.description': urdu,
}

/** i18n of the home page and the store: every key under `i18n.` is the Urdu text. */
/** @param {string} path */
export const isUrdu = (path) => path.startsWith('i18n.')

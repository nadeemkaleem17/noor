# 10.1 — API: Store and Content (public)

| Field | Value |
|---|---|
| ID | DOC-10.1 |
| Title | Store configuration, home content, menus, pages, delivery cities |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-09.9, DOC-06.1, DOC-06.2, DOC-06.8 |
| Decisions used | ADR-0005, ADR-0006, ADR-0018 |

## 1. Purpose and scope

**Governs:** the public endpoints of the `settings` and `shipping` modules that the storefront shell and content pages read.
**Does not govern:** the admin side of the same data (DOC-10.7).

All endpoints here: auth `public`, bucket `default`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` (route flag `cache: 'shared'` in the contract), accept `?locale=` (`en` or `ur`; anything else is `400`). `StoreConfigPublic.shipping.freeAboveFrom` and `defaultEta`, and the tokens `{{shipping.freeAbove}}` and `{{shipping.fee}}`, stay empty until the shipping module (M1-07) supplies them.

## 2. Endpoints

| Key | Method & path | Request | Response | Errors | Notes |
|---|---|---|---|---|---|
| `store.getConfig` | `GET /store/config` | Q: `locale?` | 200 `StoreConfigPublic` | — | Tag `store-config` |
| `content.getHome` | `GET /content/home` | Q: `locale?`, `preview?` (a token from `admin.content.homePreviewLink`) | 200 `HomePublic`; with a valid `preview` the unpublished draft (or the live page when there is none), `Cache-Control: private, no-store` | `forbidden` (a token that is wrong or has run out) | Tag `home` |
| `content.getMenu` | `GET /content/menus/:handle` | P: `handle: 'main' \| 'footer'` | 200 `MenuPublic` | `not_found` | Tag `menus`. Items whose target is not live are omitted |
| `content.getPage` | `GET /content/pages/:slug` | P: `slug` | 200 `PagePublic` | `not_found` (also for drafts) | Tag `page:<slug>`. If `slug` is an old slug: 200 `{ redirectTo: string }` |
| `content.listPages` | `GET /content/pages` | — | 200 `{ items: { slug, title, updatedAt }[] }` | — | Active pages only; for the sitemap and pre-render |
| `shipping.listCities` | `GET /shipping/cities` | — | 200 `{ items: CityPublic[] }` | — | Tag `store-config`. Only cities that belong to a zone with an enabled method |
| `promos.listPublic` | `GET /offers` | — | 200 `{ items: { code, summary, minSpend?, endsAt? }[] }` | — | Only promos staff marked public that are active now; the Offers page and the footer link read it. |
| `visits.record` | `POST /visits` | B: `{ visitor: 32 hex, path }` | 204 | `validation_failed` | Called by the shop's server with the visitor's own cookie value. Does nothing while the Store feature `visitTracking` is off. Stores only the page address without query or fragment. |
| `visits.link` | `POST /visits/link` | B: `{ visitor, order: tracking token }` | 204 | `not_found` (a link that is not valid) | After an order: the order's link proves this browser placed it, so the browser's visits belong to that customer. A browser stays with the first customer who ordered from it. |

## 3. Schemas

```ts
StoreConfigPublic = {
  brand: { name: string, tagline?: string, logoLight?: Image, logoDark?: Image, favicon?: Image },
  theme: ThemeTokens,                                   // contract, DOC-04a §6
  contact: { whatsapp?: string /* E.164 digits */, phone?: string, email?: string, address?: string,
             mapUrl?: string, hours?: string, socials: { platform: string, url: string }[] },
  priceDisplay: { showDecimals: boolean, rounding: 'none' | 'nearest' | 'up' },
  locale: { default: 'en' | 'ur', supported: ('en' | 'ur')[] },
  features: { wishlist: boolean, reviews: boolean, notifyMe: boolean, customSizing: boolean },
  policies: { returnsDays?: int, returns?: string, shipping?: string, privacy?: string, terms?: string },
  payments: { type: PaymentMethod, label: string, description?: string }[],   // enabled methods only, in display order
  shipping: { freeAboveFrom?: Money,                    // lowest free-delivery threshold across zones (trust strip)
              defaultEta?: { minDays: int, maxDays: int }, dispatchPromise?: string },
  checkout: { extraFields: FormField[], marketingConsent: { enabled: boolean, label: string } },
  seo: { homeDescription?: string },
  environment: 'local' | 'ci' | 'staging' | 'production',
}

HomePublic = {
  announcement?: { text: string, href?: string },
  notices: { id: string, text: string, href?: string, severity: 'info' | 'promo' | 'notice' }[],  // already filtered to the current time window
  heroSlides: { id: string, image: Image, heading: string, subheading?: string, buttonText?: string, buttonHref?: string }[],
  promo?: { eyebrow?: string, heading: string, text?: string, buttonText?: string, buttonHref?: string },      // absent when disabled
  editorial?: { image?: Image, eyebrow?: string, heading: string, text?: string, buttonText?: string, buttonHref?: string },
  footer: { about?: string },
}

MenuPublic = { handle: string, items: MenuItemPublic[] }
MenuItemPublic = { id: string, label: string, href: string, children?: MenuItemPublic[] }

PagePublic = { slug: string, title: string, bodyMd: string,       // tokens ({{store.phone}} …) already resolved
               seo: { title?: string, description?: string }, updatedAt: IsoDate, locale: 'en' | 'ur' /* actual language of the body */ }

CityPublic = { id: Id, name: string, province: string, aliases: string[], isMajor: boolean,
              delivery?: { fee: Money, freeAbove?: Money, etaMinDays: int, etaMaxDays: int } }   // its zone's cheapest enabled method (the product page's delivery block)
```

Never included in these responses: bank account details (they are sent with an order that chose bank transfer), `codLimitMinor` and risk thresholds (enforced by the quote), staff emails, internal ids of settings documents, provider configuration.

## 4. Example

```http
GET /api/v1/content/menus/main?locale=en

200 OK
Cache-Control: public, s-maxage=60, stale-while-revalidate=600
{ "handle": "main",
  "items": [ { "id": "m1", "label": "New", "href": "/new" },
             { "id": "m2", "label": "Women", "href": "/c/women",
               "children": [ { "id": "m3", "label": "Unstitched", "href": "/c/unstitched" } ] } ] }
```

## 5. Rules

**Always:** resolve tokens, time windows, locale fallback and dead menu targets on the server so the storefront renders what it receives; return `Image` objects for every picture.
**Never:** expose a setting the storefront does not render; return draft content; return raw media ids.
**Common mistakes:** putting customer-specific data in `store.getConfig` (it is cached for everyone); forgetting to purge `store-config` when shipping zones change (the city list and `shipping.freeAboveFrom` come from them).

## 6. Acceptance checklist

- [ ] Each response parses with its schema and contains none of the excluded fields of §3. **Open: responses are parsed by the contract on every call (the storefront and the E2E journeys read them); not a test of each excluded field.**
- [ ] A notice outside its window, a disabled promo band and a menu item to a draft collection are absent. **Open.**
- [ ] `content.getPage` returns resolved tokens and `locale: "en"` when the Urdu body is missing. **Open.**
- [ ] `shipping.listCities` omits a city whose zone has no enabled method. **Open.**

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.1-1 | One `store.getConfig` call for the shell | About 3–5 kB; cached | Payload over 15 kB → split theme out |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 2). `store.getSiteSettings` (provisional key in DOC-06.1) is replaced by `content.getHome` |

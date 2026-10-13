# 10.7 — API: Admin Content, Settings, Shipping and Payments

| Field | Value |
|---|---|
| ID | DOC-10.7 |
| Title | Home content, pages, menus, settings documents, shipping zones, cities, couriers, payment settings |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-10.1, DOC-09.9, DOC-07.9, DOC-07.10, DOC-07.11 |
| Decisions used | ADR-0006, ADR-0013, ADR-0017, ADR-0018 |

## 1. Purpose and scope

**Governs:** admin endpoints of the `settings` and `shipping` modules.
**Does not govern:** the public reads of the same data (DOC-10.1); screens (DOC-07.9 … 07.11).

All paths under `/api/v1/admin`; auth `staff`; `no-store`. Every write is audited with a field-level diff and purges the storefront cache tag named in "Notes".

## 2. Settings documents

One pair of endpoints per document of DOC-09.9 §2.1. `GET` returns `{ value, version, updatedAt?, updatedBy?, images }`; `PUT` takes `{ value, version }` and returns the same shape. A document nobody has saved reads as its default with `version: 0` (no `updatedAt`), and the first `PUT` sends `version: 0`; there is no separate create call. `images` maps each media id used in `value` to its `Image` preview (ready files only), which replaces the per-field `logoLight?: Image` style of the first draft.

| Key | Method & path | Permission | `value` schema | Errors | Notes |
|---|---|---|---|---|---|
| `admin.settings.getStore` / `.updateStore` | `GET\|PUT /settings/store` | `settings:read` / `settings:write` | `StoreSettings` | `stale_write`, `validation_failed`, `media_not_ready` | Tag `store-config` |
| `admin.settings.getTheme` / `.updateTheme` | `GET\|PUT /settings/theme` | same | `ThemeTokens & { preset?: string }` | `stale_write`, `theme_contrast_failed` | Tag `store-config` |
| `admin.settings.getCheckout` / `.updateCheckout` | `GET\|PUT /settings/checkout` | same | `CheckoutSettings` | `stale_write`, `validation_failed` (more than 3 extra fields, or a field key that collides with a fixed field) | Tag `store-config` |
| `admin.settings.getPayments` / `.updatePayments` | `GET\|PUT /settings/payments` | same | `PaymentSettings` | `stale_write`, `no_payment_method`, `validation_failed` (bank transfer enabled without account details) | Tag `store-config`. Response adds `adapters: { type, configured: boolean }[]` so the UI can show "Not connected" (DOC-07.10 §3) |
| `admin.content.getHome` / `.updateHome` | `GET\|PUT /content/home` | `content:read` / `content:write` | `HomeContent` | `stale_write`, `validation_failed` (invalid link, slide without alt), `media_not_ready` | Tag `home` |
| `admin.settings.themePresets` | `GET /settings/theme/presets` | `settings:read` | — → `{ items: { id: string, label: string, theme: ThemeTokens }[] }` | — | `storefront-gold`, `monochrome`, `botanical` |
| `admin.settings.translationStatus` | `GET /settings/translation-status` | `settings:read` | — → `{ ui: { total: int, translated: int }, products: { total: int, translated: int } }` | — | For enabling Urdu (DOC-07.11 §2) |

Schemas `StoreSettings`, `HomeContent`, `PaymentSettings`, `CheckoutSettings` are those of DOC-09.9 §2.1 (built in `packages/contract/src/settings.js`). `home.i18n.ur` holds Urdu text keyed by the id of what it translates (`notices.<id>`, `heroSlides.<id>`, `promo`, `editorial`, `announcement`, `footerAbout`). Links follow one rule (`isValidLink`: `/path`, `https://`, `mailto:`, `tel:`; plain `http://` is refused on entry); map and social links must be `https://`. The theme contrast gate (`contrastFailures`) lives in `@noor/contract` so the API and the Appearance page run the same code.

Provider credentials are **not** part of `PaymentSettings` and no endpoint reads or writes them (DOC-11 §7).

## 3. Pages

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.pages.list` | `GET /pages` | `content:read` | Q: `q?`, `status?`, `page`, `size`, `sort` (`title`, `-updatedAt`) | 200 `Page<AdminPageRow>` | — | |
| `admin.pages.get` | `GET /pages/:id` | `content:read` | — | 200 `AdminPage` | `not_found` | |
| `admin.pages.create` | `POST /pages` | `content:write` | B: `PageInput` | 201 `AdminPage` | `slug_taken` | |
| `admin.pages.update` | `PUT /pages/:id` | `content:write` | B: `PageInput & { version }` | 200 `AdminPage` | `stale_write`, `slug_taken`, `page_locked` (slug change or draft on a locked page) | Tag `page:<slug>`; a slug change writes a redirect |
| `admin.pages.delete` | `DELETE /pages/:id` | `content:delete` | — | 204 | `page_locked` | |
| `admin.pages.preview` | `POST /pages/preview` | `content:read` | B: `{ bodyMd: string }` | 200 `{ bodyMd: string }` (tokens resolved) | — | The client renders it with the shared Markdown component (DOC-07.9 §3.2) |

```ts
PageInput = { title: string, slug: string, bodyMd: string, status: 'draft' | 'active',
              seo?: { title?: string, description?: string }, i18n?: { ur?: { title?: string, bodyMd?: string } } }
AdminPage = PageInput & { id: Id, locked: boolean, version: int, updatedAt: IsoDate, updatedBy?: string, storefrontUrl: string }
AdminPageRow = { id: Id, title: string, slug: string, status: string, locked: boolean, updatedAt: IsoDate, updatedBy?: string }
```

## 4. Menus

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.menus.get` | `GET /menus/:handle` | `content:read` | P: `'main' \| 'footer'` | 200 `AdminMenu` | `not_found` | |
| `admin.menus.update` | `PUT /menus/:handle` | `content:write` | B: `{ items: MenuItemInput[], version }` | 200 `AdminMenu` | `stale_write`, `validation_failed` (depth, counts, invalid link) | Tag `menus` |
| `admin.links.search` | `GET /links` | `content:read` | Q: `q` (≥ 2) | 200 `{ items: { type: 'category' \| 'collection' \| 'product' \| 'page' \| 'static', label: string, href: string }[] }` | — | Feeds `LinkField` (DOC-07.9 §2); ≤ 20 results |

```ts
MenuItemInput = { id?: string, label: string, href: string, i18n?: { ur?: { label?: string } }, children?: MenuItemInput[] }
AdminMenu = { handle: string, version: int, items: (MenuItemInput & { id: string, targetLive: boolean, children?: … })[] }
```

## 5. Shipping

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.shipping.listZones` | `GET /shipping/zones` | `settings:read` | — | 200 `{ items: AdminZone[], unassignedCityCount: int }` | — | |
| `admin.shipping.createZone` | `POST /shipping/zones` | `settings:write` | B: `ZoneInput` | 201 `AdminZone` | `validation_failed` | Tag `store-config` |
| `admin.shipping.updateZone` | `PUT /shipping/zones/:id` | `settings:write` | B: `ZoneInput & { version }` | 200 `AdminZone` | `stale_write`, `no_deliverable_city` | Cities listed here are **moved** from any other zone in the same transaction |
| `admin.shipping.deleteZone` | `DELETE /shipping/zones/:id` | `settings:write` | — | 204 | `no_deliverable_city` (it is the last zone with an enabled method) | Its cities become unassigned |
| `admin.shipping.zoneImpact` | `POST /shipping/zones/:id/impact` | `settings:read` | B: `ZoneInput` | 200 `{ citiesRemoved: int, citiesMovedIn: { city: string, fromZone: string }[], openCarts: int }` | — | Shown before saving (DOC-07.10 §4) |
| `admin.shipping.listCities` | `GET /shipping/cities` | `settings:read` | Q: `q?`, `province?`, `unassigned?: 1`, `page`, `size` | 200 `Page<AdminCity>` | — | |
| `admin.shipping.createCity` | `POST /shipping/cities` | `settings:write` | B: `{ name: string, province: string, aliases?: string[], isMajor?: boolean }` | 201 `AdminCity` | `validation_failed` (duplicate name) | |
| `admin.shipping.updateCity` | `PUT /shipping/cities/:id` | `settings:write` | same | 200 `AdminCity` | — | A city used by orders can be renamed but not deleted; there is no delete route |
| `admin.shipping.matchCities` | `POST /shipping/cities/match` | `settings:read` | B: `{ names: string[] }` (≤ 500) | 200 `{ matched: { input: string, city: AdminCity }[], unknown: string[] }` | — | "Paste a list" (matches names and aliases, case-insensitive) |
| `admin.couriers.list` / `.create` / `.update` | `GET\|POST /couriers`, `PUT /couriers/:id` | `settings:read` / `settings:write` | B: `{ name: string, trackingUrlPattern?: string, trackingRequired: boolean, enabled: boolean, sortOrder?: int }` | `Courier` | `validation_failed` (pattern not `https://` or missing `{tracking}`) | No delete route (disable instead) |

```ts
ZoneInput = { name: string, cityIds: Id[],
              methods: { id?: Id, label: string, fee: Money, freeAbove?: Money, etaMinDays: int, etaMaxDays: int,
                         codAllowed: boolean, enabled: boolean, i18n?: { ur?: { label?: string } } }[] }   // order = display order
AdminZone = { id: Id, name: string, version: int, cityCount: int, cities: { id: Id, name: string }[] /* first 50 */,
              methods: (ZoneInput['methods'][number] & { id: Id })[] }
AdminCity = { id: Id, name: string, province: string, aliases: string[], isMajor: boolean, zone?: { id: Id, name: string } }
Courier = { id: Id, name: string, trackingUrlPattern?: string, trackingRequired: boolean, enabled: boolean, sortOrder: int }
```

Built at M1-07 (`packages/contract/src/shipping.js`, `apps/api/src/modules/shipping`). `ZoneInput.methods` has 1 to 4 entries and at least one enabled; a method with an `id` is updated, one without is created, one left out is deleted, and the array order is the display order. A change that would leave no city in a zone with an enabled method (while there was one before) is `422 no_deliverable_city`; an empty store may still be set up zone by zone. `openCarts` is always 0 until the cart module exists. `quote` is a service function, not a route: `shipping.quote(db, { cityId, methodId?, amountAfterDiscount })` returns the zone, method, fee (zero at or above the method's `freeAbove`), ETA and `codAllowed`, or throws `city_not_served`.

## 6. Example

```http
PUT /api/v1/admin/settings/theme
X-CSRF-Token: …
{ "version": 3, "value": { "colors": { "bg": "#FBF8F3", "fg": "#C9A227", … }, … } }

422 Unprocessable Content
{ "type": "https://rubaya.pk/problems/theme_contrast_failed", "title": "Theme contrast failed", "status": 422,
  "code": "theme_contrast_failed", "requestId": "…",
  "pairs": [ { "pair": "fg/bg", "ratio": 2.3, "min": 4.5 } ] }
```

## 7. Rules

**Always:** validate a document with its schema and service rules before storing; return and require `version`; purge the stated cache tag after commit (through the outbox); run the same contrast and link validators the UI runs.
**Never:** store or return provider secrets; allow a state with no enabled payment method or no deliverable city; delete cities or couriers that orders reference.
**Common mistakes:** saving a zone and leaving its former cities in the old zone (the move is part of the same transaction); forgetting that shipping changes affect `store.getConfig` (`freeAboveFrom`) and `shipping.listCities`.

## 8. Acceptance checklist

- [ ] Every `PUT` here with a stale `version` returns `409 stale_write`. **Open: tested for the documents of `settings.int.test.js`, not every `PUT`.**
- [x] A theme failing the contrast gate is rejected by the API even if the UI check is bypassed. (`apps/api/test/settings.int.test.js` ("refuses a theme that fails the contrast gate").)
- [x] Disabling the last payment method → `422 no_payment_method`. (`apps/api/test/settings.int.test.js` (`no_payment_method`).)
- [x] Moving a city between zones through `updateZone` leaves it in exactly one zone. (`apps/api/test/shipping.int.test.js` ("keep a city in exactly one zone: claiming it moves it").)
- [ ] Each write produces one audit entry whose diff lists only changed fields. **Open.**
- [ ] After each write the corresponding public endpoint (DOC-10.1) reflects it once the cache tag is purged. **Open: the shop reads its settings within 30 s (E2E-13, theme and Urdu).**

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.7-1 | One endpoint pair per settings document | Five documents; simple permissions per document | More documents → a generic `/settings/:key` |
| Q-10.7-2 | `openCarts` in zone impact | Count of carts updated in the last 24 h whose last quote used a removed city; approximate | Not useful → drop |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 2) |

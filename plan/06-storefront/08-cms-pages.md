# 06.8 — Storefront: CMS Pages

| Field | Value |
|---|---|
| 2026-10-13 | M7-05: the drafts of the four required pages are fuller (shipping and following an order, advance payment on very large orders, damaged or wrong items, the two cookies and the speed measurements, how long records are kept, delivery times as estimates, made-to-order terms, limits of responsibility, governing law). No new token; a test (`apps/api/test/launch.test.js`) checks that every token they use is one the shop knows and every link goes to a page that exists |
| ID | DOC-06.8 |
| Title | Content pages, policies, contact, size guide, safe Markdown rendering |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-04b |
| Decisions used | ADR-0004, ADR-0006, ADR-0018 |

## 1. Purpose and scope

**Governs:** `/pages/:slug` and `/size-guide`: where the content comes from, how Markdown is rendered safely, and the pages every store must have.
**Does not govern:** the editor staff use (DOC-07 content), menus (DOC-06.1 §3).

Fixes F-24 and F-25: pages are hard-coded in `CmsPage.jsx:4-22` today, and contact copy duplicates store config.

## 2. `/pages/:slug`

| Rule | Detail |
|---|---|
| Source | `content.getPage(slug)` → contract `CmsPage` (`title`, `bodyMd`, `seo`). Only `status: 'active'`; otherwise 404 |
| Layout | Breadcrumb (Home › title), `<h1>` = `title`, body in a 65 ch column |
| Rendering | `bodyMd` is rendered **on the server** to React elements with `react-markdown` (no `dangerouslySetInnerHTML`). Raw HTML in the Markdown is not rendered |
| Allowed elements | `h2`, `h3`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `blockquote`, `hr`, `table` (+ `thead`, `tbody`, `tr`, `th`, `td`), `img`, `br`. A Markdown `#` (h1) is rendered as `h2` so the page keeps one `<h1>` |
| Links | Same validation as `LinkButton` (DOC-04b §4.1): `http(s)`, `/`, `mailto:`, `tel:`, `https://wa.me/`. External links get `rel="noopener noreferrer"`; invalid links render as plain text |
| Images | Only URLs on our image host (`PUBLIC_IMG_URL`) render, through `Image` with intrinsic size from the Markdown title attribute `"WxH"`; others are dropped. `alt` is required by the admin editor |
| Tokens in content | `{{store.phone}}`, `{{store.email}}`, `{{store.whatsapp}}`, `{{store.address}}`, `{{shipping.freeAbove}}`, `{{shipping.fee}}`, `{{returns.days}}` are replaced from `StoreConfig` before rendering, so policy text never hard-codes a number that lives in settings (F-05, F-25). Unknown tokens render as nothing |
| Cache | S class (`s-maxage=3600`), purged by tag `page:<slug>` on save (DOC-08) |
| Pre-render | The four required pages (§3) are pre-rendered at build as a warm fallback (ADR-0004) |
| Locale | Content fields are `{ en, ur? }` (ADR-0018); `/ur/pages/:slug` falls back to English and sets `lang="en"` on the body container |

`react-markdown` is the one new dependency of this page: a Markdown-to-React renderer that outputs elements instead of an HTML string, which removes the need for a separate HTML sanitiser. Its `allowedElements` and `urlTransform` options implement the two rows above.

## 3. Required pages

Seeded by `db:seed` and listed in the footer menu. Staff can edit but not delete them (DOC-07 content).

| Slug | Title | Must contain |
|---|---|---|
| `shipping-returns` | Shipping & returns | Delivery cities/zones summary, fees via tokens, delivery times, return window, what cannot be returned (cut unstitched fabric, made-to-order, sale items), how to request a return |
| `privacy` | Privacy policy | What is collected at checkout, who it is shared with (couriers, payment providers), contact for deletion requests |
| `terms` | Terms of service | Pricing and availability, order confirmation by phone, cancellation, COD refusal policy |
| `contact` | Contact us | Rendered from `StoreConfig.contact` by the route, **not** from Markdown: phone (`tel:`), WhatsApp, email (`mailto:`), address, map link, opening hours, socials. Optional intro from the page's `bodyMd`. No contact form in v1 |
| `about` | About us | Optional; shown in the footer only when active |

The drafts are in `apps/api/src/seed/pages.js` and say only what the shop's software does (cash on delivery, a phone call to confirm, cancel before dispatch, the tracking link, made-to-order pieces, two cookies and no advertising or tracking services, anonymising on request). Every number and contact detail is a token (`{{shipping.fee}}`, `{{returns.days}}`, `{{store.phone}}`...); a token whose setting is empty prints nothing, which is why `launch:check` (DOC-14 §5.2) refuses to open a shop with an empty contact setting. They are drafts, not legal advice: the owner reads every word before launch (README A-09, DOC-16 LAUNCH-10). Pages already in a database are never overwritten by the seed.

`StoreConfig.policies.*` (short strings) are used for one-line summaries elsewhere (PDP delivery accordion, checkout footer); the full text lives in these pages.

## 4. `/size-guide`

| Rule | Detail |
|---|---|
| Source | `catalog.listSizeCharts` → all active `SizeChart`s grouped by size system (Women's stitched, Footwear EU …) |
| Layout | `<h1>` Size guide; one `Accordion` item per chart; each has the measurement table, an in/cm toggle (client state; both unit sets are in the HTML so it works without JS as two tables), and the how-to-measure image |
| Table | Real `<table>` with `<th scope>`; horizontally scrollable inside its own container on small screens with the first column sticky |
| Linked from | Footer, PDP "Size guide" (which opens the single relevant chart in a drawer, DOC-06.4 §4) |
| Cache | S class, tag `size-charts` |

## 5. Rules

**Always:** render Markdown to elements on the server with the allow-list; read contact details and policy numbers from `StoreConfig`.
**Never:** use `dangerouslySetInnerHTML` for CMS content; allow raw HTML, scripts, iframes or arbitrary image hosts in page bodies; hard-code a policy page in the app.
**Common mistakes:** a second `<h1>` from the body's first heading; a delivery fee typed into the policy text instead of the token.

## 6. Acceptance checklist

- [x] A page body containing `<script>alert(1)</script>`, `[x](javascript:alert(1))` and `![x](https://evil.example/a.png)` renders none of them as active content (unit test of the renderer config). (`shell.server.test.js` renders such a body through the real route: no `alert(1)`, no `<script`, no `javascript:`, no picture from `evil.example`; the renderer's own unit tests are in `@noor/ui` (M2-04).)
- [x] Changing the store phone in settings changes it on `/pages/contact` and wherever `{{store.phone}}` is used, with no content edit. (The contact page is drawn by the route from `StoreConfig.contact`, and the API puts the settings into the text where it names `{{store.phone}}` and the others (`settings.int.test.js`). Not tried by changing a setting and looking: the shop's configuration is kept 30 seconds in the storefront and a page up to an hour by a CDN, which purges by tag when that exists.)
- [x] A draft page returns 404. (`shell.server.test.js` with a stand-in API that answers 404 for it; the API's own rule that only an active page is given is in `settings.int.test.js`.)
- [x] `/size-guide` tables are readable at 360 px and have header cells with `scope`. (Each table is in its own scrolling box with the first column kept in view, and every header cell has `scope`: checked in the browser pane and in `shell.server.test.js`. Not looked at on a 360 px screen.)
- [x] Each required page exists after `db:seed` and is linked in the footer. (By hand against the seeded shop: `about`, `contact`, `privacy`, `shipping-returns` and `terms` all answer 200 and are in the footer menu.)

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.8-1 | `react-markdown` current major and its option names (`allowedElements`, `urlTransform`) | As in its documentation up to mid-2026; not re-checked | First implementation |
| Q-06.8-2 | Legal text for privacy/terms | **Answered (README A-09): we write standard drafts** as part of the seed data (privacy: what checkout collects, sharing with couriers, deletion contact; terms: pricing, phone confirmation, cancellation, COD refusal, returns). Not legal advice; the launch checklist (DOC-16) has an owner read-through item | Owner supplies reviewed text |
| Q-06.8-3 | `PageTemplate`-driven pages (sections/blocks) | Not in v1 (DOC-06.2 §2) | Same trigger |
| Q-06.8-4 | Contact form | Not in v1 (WhatsApp, phone, email) | Owner asks |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Owner answer: legal pages drafted by us (A-09) |
| 2026-10-07 | M5-09 built (`routes/page.jsx`, `routes/size-guide.jsx`, `features/content/contact-details.jsx`, `features/product/size-chart.jsx`). Notes: (1) The tokens are not resolved by the storefront: `content.getPage` already gives the text with the shop's phone, email, address, free-delivery line, fee and return days in it (`resolveTokens` in the API), so the page only draws it; the section 2 row about tokens is the API's job. (2) `/pages/contact` draws the text, then the details from `StoreConfig.contact` (phone as `tel:`, WhatsApp, email, address with the map link, hours, socials); what is not set is not shown. (3) A page with no text in the visitor's language is shown in the other one, with `lang` (and `dir`) set on its heading and its body. (4) The size guide shows each chart as a `<details open>` (the charts have no size system to group by in the API's answer, so one block per chart): the in/cm switch with JavaScript, and without it both units, as two tables each. The drawer of the product page uses the same table component. (5) The footer gets a fixed "Size guide" link beside the menu's own links. (6) Pre-rendering the four required pages at build (ADR-0004) is not done: a page is rendered on request and kept by the cache class; revisit with the CDN. |
| 2026-10-02 | M2-04: renderer built as `Markdown` in `@noor/ui/markdown`; also needs `remark-gfm` for tables; `skipHtml` drops raw HTML; images need a `"WxH"` title and our image origin (checked with `startsWith(origin + "/")`, so `img.rubaya.pk.evil.com` fails); §6 first bullet is a unit test |

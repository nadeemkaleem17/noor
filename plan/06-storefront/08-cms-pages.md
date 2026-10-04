# 06.8 — Storefront: CMS Pages

| Field | Value |
|---|---|
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

- [ ] A page body containing `<script>alert(1)</script>`, `[x](javascript:alert(1))` and `![x](https://evil.example/a.png)` renders none of them as active content (unit test of the renderer config).
- [ ] Changing the store phone in settings changes it on `/pages/contact` and wherever `{{store.phone}}` is used, with no content edit.
- [ ] A draft page returns 404.
- [ ] `/size-guide` tables are readable at 360 px and have header cells with `scope`.
- [ ] Each required page exists after `db:seed` and is linked in the footer.

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
| 2026-10-02 | M2-04: renderer built as `Markdown` in `@noor/ui/markdown`; also needs `remark-gfm` for tables; `skipHtml` drops raw HTML; images need a `"WxH"` title and our image origin (checked with `startsWith(origin + "/")`, so `img.rubaya.pk.evil.com` fails); §6 first bullet is a unit test |

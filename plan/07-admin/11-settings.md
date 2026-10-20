# 07.11 — Admin: Store Settings, Appearance and Data

| Field | Value |
|---|---|
| ID | DOC-07.11 |
| Title | Store settings, theme editor, import/export |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-04a §6, §9, DOC-06.5 §4.1, README (A-10) |
| Decisions used | ADR-0006, ADR-0013, ADR-0018 |

## 1. Purpose and scope

**Governs:** `/settings/store`, `/settings/appearance`, `/settings/data`.
**Does not govern:** shipping and payments (DOC-07.10); staff (DOC-07.12); how tokens become CSS (DOC-04a).

View needs `settings:read`; edit `settings:write`; the data screen needs `settings:manage`.

## 2. Store settings (`/settings/store`)

One page of cards; each card has its own Save (they are independent and some are sensitive).

| Card | Field | Control | Rules |
|---|---|---|---|
| Brand | Store name | `Input` | Required (seed: "Rubaya"). Used in titles, emails, invoices, JSON-LD |
| | Tagline | `Input` | ≤ 80 |
| | Logo (light background), logo (dark background, optional) | `ImageUpload` | SVG or PNG, ≤ 1 MB; SVG is sanitised server-side (scripts and external references removed) |
| | Favicon | `ImageUpload` | PNG ≥ 180 px square; the API produces the sizes |
| Contact | WhatsApp number | `PhoneInput` | Used for every `wa.me` link (DOC-06.6 §5) |
| | Phone, email, address, map link | `Input`s | Map link must be `https://` |
| | Opening hours | `Input` | Free text ≤ 120 |
| | Social links | Repeating rows: platform (Instagram, Facebook, TikTok, YouTube, Pinterest), URL | `https://` only |
| Prices | Show decimals | Checkbox | Off: `Rs. 6,990`; on: `Rs. 6,990.00` |
| | Display rounding | none / nearest rupee / up | Presentation only; charged amounts are exact paisa (ADR-0013) |
| | Order number prefix | `Input` | 2–4 letters (seed `RB`); changing it affects new orders only |
| Languages | Supported languages | Checkboxes: English (always), Urdu | Enabling Urdu requires the Urdu catalog to exist; shows the % of UI strings and of active products translated |
| | Default language | `NativeSelect` | |
| Features | Wishlist, Reviews, Back-in-stock alerts, Custom sizing | `Switch` each | Each has a one-line effect description. `findMySize`, `compare`, `multiCurrency` are not shown (not built in v1) |
| Checkout | Extra checkout fields | Form-field editor (same component as DOC-07.4 §5.3) | Max 3 extra fields. Name, phone, city and address are fixed and cannot be removed |
| | Marketing consent checkbox | `Switch` + label text | DOC-06.7 §2 |
| Policies (short) | Returns window (days), one-line returns, shipping, privacy and terms summaries | `NumberInput`, `Input`s | Feed `{{returns.days}}` and the PDP/checkout one-liners; full text lives in CMS pages |
| SEO | Home page meta description | `Textarea` ≤ 160 | DOC-06.9 §2 |
| Notifications | Order notification email(s) for staff | `Input` (comma-separated emails) | Used when an email provider exists (DOC-12) |

Currency is fixed to PKR and text direction follows the language; neither is a setting (the current screen's "Currency" and "Direction" fields are removed).

## 3. Appearance (`/settings/appearance`)

Edits `StoreConfig.theme` (contract `ThemeTokens`). Left: controls. Right: a **live preview** rendering real `@noor/ui` components (header strip, product card, buttons, price, badge, form field) inside a container that applies the draft theme through the same `themeCss()` function the storefront uses (DOC-04a §6).

| Control | Options |
|---|---|
| Preset | `storefront-gold`, `monochrome`, `botanical` (DOC-04a §4.2). Choosing one fills every value below; editing any value afterwards marks the theme "Custom (based on …)" |
| Colours | The 12 `ThemeTokens.colors` keys, each a colour input + hex field (`#RRGGBB` only) |
| Heading font, body font | `NativeSelect` over the self-hosted allow-list (DOC-04a §7) |
| Corners | Controls: sharp / soft / round; cards: sharp / soft / round; images: none / soft |
| Density | comfortable / compact |
| Product image ratio | 3:4, 2:3, 4:5, 1:1 |
| Header | Layout left / centre; sticky on/off |

**Contrast check panel** (same function as the CI gate, `@noor/ui/contrast`):

| Pair | Minimum | Effect when failing |
|---|---|---|
| Text on background, text on surface | 4.5 | **Blocks Save** |
| Muted text on background | 4.5 | Blocks Save |
| Sale colour on background | 4.5 | Blocks Save |
| Text on accent (button label) | 4.5 | Blocks Save; "Fix for me" sets `onAccent` to black or white, whichever passes |
| Accent as text on background | 4.5 | Warning only (the storefront falls back to the text colour for accent-coloured text) |
| Focus ring on background | 3.0 | Blocks Save |

Other rules: "Reset to preset" restores the last chosen preset; Save purges the storefront `store-config` tag; the preview shows a 360 px phone frame and a desktop strip; dark mode is not offered (storefront is light-only in v1, DOC-04a §6).

## 4. Data (`/settings/data`)

Replaces "Data & publishing" (localStorage bundle import/export and "reset demo data").

| Action | Detail |
|---|---|
| Export products | Same CSV as DOC-07.3 §10 (all products) |
| Export orders | CSV for a date range (max 366 days): one row per order line with order number, dates, status, customer name, phone, city, SKU, quantity, unit price, line total, order totals, payment method, courier, tracking. Needs `orders:export`; audited |
| Export customers | Needs `customers:export`; audited (DOC-07.6 §2) |
| Import price/stock | DOC-07.3 §10 |
| Job list | Table of the last 20 import/export jobs: type, requested by, time, status, rows, download link (links expire after 24 h) |
| Backups | Read-only line: time of the last successful database backup as reported by the API (DOC-14). No restore from the UI |

Exports run as background jobs (ADR-0009) and deliver a toast and a row in the job list; files are private objects with signed, expiring URLs (ADR-0011).

There is **no** "reset all data" in the admin. Development resets use `pnpm --filter @noor/api db:seed` (DOC-14).

## 5. Rules

**Always:** validate theme values with the storefront's own function and block unreadable themes; audit every settings change; keep contact details and policy numbers here as the single source.
**Never:** offer a destructive reset in a production UI; accept free-form CSS, font URLs or colour formats other than 6-digit hex; expose secrets on these screens.
**Common mistakes:** a preview that uses different code from the storefront; saving a gold accent as the text colour; duplicating the phone number into CMS text.

### Emails (`/settings/emails`, added 2026-10-20, plan/17 item 13)

Needs `settings:manage`. One card **Emails** with its own Save, the key `emails` of the store document: **Send emails to customers** (all on or off), **Sender name** and **Replies go to**, and the six events (order received, confirmed, dispatched, delivered, cancelled, returned), each with a switch and **Edit the wording**: a subject and a message, with buttons that insert words from the order (`{{name}}`, `{{orderNo}}`, `{{total}}`, `{{link}}`, `{{items}}`, `{{eta}}`, `{{courier}}`, `{{tracking}}`, `{{amountDue}}`, `{{account}}`, `{{city}}`, `{{store}}`). A word the shop does not know is refused on save. Empty subject and message mean the shop's own wording (also what a bank transfer or made-to-order message uses when no own wording is set). **Preview** shows the text filled from the newest order (or made-up values) without saving; **Send a test** sends it to an address typed there. Below, **What was sent**: every email with its result (Sent, Failed with the server's reason, Not sent because no mail server is set up). The address mail comes from is the server's (`MAIL_FROM`): the mail service vouches for it, so only the name can be changed. The WhatsApp texts and the staff mail of a new order are not changed by these settings. Not built: Urdu wording, attachments, a per-product text, resending from the log.

## 6. Acceptance checklist

- [x] The appearance preview and the storefront produce the same CSS for the same theme (shared function, unit test). (`appearance.test.jsx` compares the preview style with `themeCss`, the function the storefront uses.)
- [x] A theme with `#C9A227` text on `#FBF8F3` cannot be saved; the panel names the failing pair and ratio. (Test; Save is disabled and the API refuses it too.)
- [ ] An uploaded SVG logo containing `<script>` is stored without it. (Images only are accepted today, so an SVG is refused outright; the sanitiser question is Q-07.11-2.) **Not applicable: images only are accepted; SVG is refused.**
- [ ] Changing the WhatsApp number changes every `wa.me` link on the storefront after the cache purge. (Admin side done: stored as digits; the storefront links come with M5.) **Open: the shop reads its settings within 30 s; no journey changes the number.**
- [ ] Turning "Reviews" off removes reviews from the PDP and the Reviews item from the admin sidebar. (The switch is saved; the PDP and the sidebar item follow with the reviews screens, M6.) **Open: the admin half is tested (`nav-counts`, reviews screen); the PDP half is not.**
- [ ] An export larger than 1,000 rows completes as a job and its link stops working after 24 h. (The Data screen shows backup and queue status; the exports and the job list wait for the endpoints, M4-10.) **Superseded: exports answer at once up to 5,000 rows and are audited (M4-10); there is no export job.**
- [x] No reset or delete-all control exists. (`data.test.jsx`.)

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.11-1 | Where each setting is stored (`StoreConfig` vs `SiteSettings`) | One `store_settings` structure; DOC-09 defines it and Phase 7 reconciles the contract | DOC-09 |
| Q-07.11-2 | SVG sanitising library on the server | Chosen in DOC-08; alternatively accept PNG only | DOC-08 |
| Q-07.11-3 | Font allow-list beyond three families | Adding one is a code change (DOC-04a §7) | Owner wants another typeface |
| Q-07.11-4 | Translation completeness numbers | Provided by the API | DOC-10 |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-05 | M3-06 built (`apps/admin/src/features/settings`): store settings as nine independent cards (each saves the latest document with only its own keys), appearance (live preview with `themeCss`, contrast panel that blocks Save, presets, "Fix the button text"), data (read-only backup and queue status; exports list not built: no endpoints until M4-10) |

# 06.12 — Admin to storefront coverage: everything staff can manage, and where the shop shows it

| Field | Value |
|---|---|
| ID | DOC-06.12 |
| Title | Coverage map: every admin capability against what a customer sees |
| Status | Draft, written 2026-10-16 after the owner's review; becomes a checked document in M8-01 |
| Owner | Tech lead |
| Depends on | DOC-07 (admin), DOC-06.1 to DOC-06.11 |

## 1. Why this document exists

The plan described the admin screens (DOC-07) and the storefront pages (DOC-06) **separately**. Nothing in the plan said, for each thing staff can edit, *where a customer sees it*. So a setting could exist, work, pass its tests and never reach a customer. This map is that missing cross-check. Read in the order of the admin menu. Verified by reading the code and the live shop on 2026-10-16.

Legend: **Shown** = a customer sees it and it follows the admin value. **Partly** = shown somewhere, but not where a customer expects it or not in full. **Not shown** = staff can set it, a customer never sees it (a dead control). **Staff only** = by design, no customer view.

## 2. The map

### Sales

| Admin capability | Verdict | Where the shop shows it today | Gap and what v2 does (task) |
|---|---|---|---|
| Orders: status, timeline, courier, tracking number | Shown | Order page (token link) and `/track`: status steps, items, totals, delivery address masked | A "Track order" link is not in the header (M8-03) |
| Orders: cancel, switch to COD, review invite | Shown | Order page buttons; review form by link | none |
| Customers (one record per phone, refusals, "no COD" flag) | Staff only | The flag stops COD at checkout | none; the shop is guest-only by decision |
| Promo codes (percent, fixed, free delivery, minimum spend, targets) | Partly | A code box in the cart and checkout; the discount line | Customers cannot discover an offer; the rule in words (`summary`) is not shown anywhere public. v2: promo band and cart hint use a flagged public offer (M8-07, M8-08) |
| Reviews (moderation, photos, fit) | Partly | Product page list with photos | No star distribution or fit summary, no highlight on the home page (M8-06, M8-08) |

### Catalog

| Admin capability | Verdict | Where the shop shows it today | Gap and what v2 does (task) |
|---|---|---|---|
| Categories: tree (2+ levels), picture, description, SEO, filters shown | **Partly** | Category pages (title, description, filters, sub-category links); home tiles for **top-level categories with a picture only** | **The header navigation does not list them** (seed writes a two-item menu, fallback only when the menu is empty); no mega menu; sub-categories not reachable from anywhere but their parent page (M8-02, M8-03) |
| Collections (rules, featured, picture) | **Partly** | Up to 3 featured on the home page; each has a page | No collections index, not in the navigation, not in the footer (M8-02, M8-03) |
| Attributes (fabric, colour, occasion...) | Shown | Filters on listings; swatches on the product page | Not offered as "shop by fabric/occasion" entry points (M8-08) |
| Sizes and size charts | Shown | Size chips; size guide drawer and page | none |
| Custom-size forms (made to measure) | Shown | Product page form | none |
| Products: title, subtitle, brand, kind, badges, pictures, options, variants, details, fabric and care, what is included, colourway, related, bundle, SEO, rating | Shown (the product page reads almost every field) | Product page | `subtitle` is not on the listing card (M8-05); per-size stock not on the card (M8-05) |
| Inventory and low-stock threshold | Partly | "Only N left" and "Sold out" on the product page | Not on the card; the threshold itself is internal (M8-05) |
| Related products, recently viewed | Shown | Product page | none |

### Content

| Admin capability | Verdict | Where the shop shows it today | Gap and what v2 does (task) |
|---|---|---|---|
| Home: announcement bar, notices | Shown | Top of every page | none |
| Home: hero slides, promo band, editorial band, footer about | Shown | Home page and footer | Hero text was unreadable until the colour fix of 2026-10-15 |
| Pages (CMS) | Partly | Linked from the footer and the `pages` menu; the four policy pages | Custom pages appear only if staff add them to a menu |
| **Menu `main`** | **Partly** | Header (links; a parent opens a panel on click) | Two items by default; no mega menu (M8-02, M8-03) |
| **Menu `footer`** | Partly | One footer column | Only one footer menu exists (`main`, `footer`); v2 splits the footer into Shop, Help and Company from the category tree and the pages (M8-02) |

### Settings

| Admin capability | Verdict | Where the shop shows it today | Gap and what v2 does (task) |
|---|---|---|---|
| Store: name, logo for light backgrounds | Shown | Header | none |
| **Store: logo for dark backgrounds** | **Not shown** | nowhere | Used by the transparent header and the footer when the theme is dark (M8-03, M8-09) |
| **Store: favicon upload** | **Not shown** | The shop uses a built-in icon (added 2026-10-15) and ignores the uploaded one | Uploaded favicon wins, built-in is the fallback (M8-02) |
| Store: tagline | Partly | Page title only | Show under the logo or in the footer (M8-03) |
| Store: phone, email, WhatsApp, address, hours, map link | Shown | Footer, contact page, floating WhatsApp button | Hours and map only on the contact page |
| Store: social links | Shown | Footer | none |
| Store: feature switches (wishlist, reviews, notify-me, custom sizing) | Shown | Parts appear or disappear | none |
| Store: return days, policy summaries | Partly | Trust strip on the home page; policy pages | Not on the product page next to the buy button (M8-06) |
| **Store: dispatch promise ("ships within 1-2 days")** | **Not shown** | nowhere (the field is sent to the shop and never read) | Product page delivery block, cart and checkout (M8-06, M8-07) |
| **Shipping: default delivery time, free-delivery threshold, zone fees** | Partly | Checkout (after choosing a city); free-over amount in the trust strip and banner | Not on the product page or the cart as an estimate; no progress bar (M8-06, M8-07) |
| Payments: methods, names, descriptions | Shown | Checkout | none |
| Checkout: extra fields, marketing consent | Shown | Checkout | none |
| **Appearance: colours, fonts, corners, density, picture ratio** | Shown | Everywhere | none |
| **Appearance: header layout (left or centre)** | **Not shown** | The admin offers it; the header ignores it | Honour it (M8-03) |
| **Appearance: "keep the header at the top while scrolling"** | **Not shown** | The admin offers a switch; the header is always sticky | Honour it, and add hide-on-scroll-down (M8-03) |
| Languages (English, Urdu) | Shown | Language switch when two are on; Urdu is off by decision | none |
| SEO: home description | Shown | Page description | none |
| Data (exports) | Staff only | | |
| Staff and roles, audit log, dashboard, my account | Staff only | | |

## 3. What the map says

- **Eleven fields staff can set that no customer ever sees**, counted by a test over the real schemas (`apps/storefront/test/admin-coverage.test.js`): the logo for dark backgrounds, the uploaded favicon, the dispatch promise, the header layout, the "keep the header at the top" switch, the custom-sizing switch, a notice's severity, and the four policy summaries (returns, shipping, privacy, terms). The table in §2 had found the first five by reading; the test found the last six. All are admin controls that look like they work and do nothing, which is worse than a missing feature. A further set is shown only half-way (promo offers, reviews, categories in the navigation, collections, inventory cue, custom pages, menu `main`, menu `footer`, tagline, shipping estimate).
- The product page is the one place that reads almost everything the admin writes. The **shell** (header, navigation, footer) and the **discovery** surfaces (search, collections, offers) are where the gaps are, and those are what a customer meets first.

## 4. Rules from now on

1. **Every field staff can edit has a row in this map** and a verdict. A field with "Not shown" needs a task or a written reason ("Staff only"). A new admin field is not done until its row exists.
2. **A test enforces it.** M8-01 adds `apps/storefront/test/admin-coverage.test.js`: it lists the keys of `StoreSettings`, `HomeContent`, `ThemeTokens`, `Category`, `Collection`, `ProductDetail` and the menu handles, and fails when a key has no row in a machine-readable copy of this map (`admin-coverage.map.js`). Adding a setting without deciding where it shows then fails the build.
3. **First-run test.** A freshly seeded shop must satisfy: every top-level category is reachable from the header in one interaction and every sub-category in two. This is checked by the end-to-end suite on the seeded data, not on a stand-in.
4. **Review a slice, not the finished site.** From M8, each page gets an owner review of its first working version (screenshots at 390 and 1280 px against the scorecard) before the rest of the work on that page continues.
5. **Compare before designing.** Each page's task starts by looking at the reference shops of DOC-06.11 §3.3 for that page and writing down what to match and what to beat.

## 5. Changelog

| Date | Change |
|---|---|
| 2026-10-16 | Created |
| 2026-10-16 | M8-01: the coverage test over the real schemas found six more dead controls; the map is `apps/storefront/test/admin-coverage.map.js` (not a JSON file) |

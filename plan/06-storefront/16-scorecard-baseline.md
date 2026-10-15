# 06.16 — UX scorecard: the baseline of the shop as it stood on 2026-10-16

| Field | Value |
|---|---|
| ID | DOC-06.16 |
| Title | Baseline scores for the 39 rows of DOC-06.11 §8.3, before any M8 change |
| Status | Written 2026-10-16 (M8-01); re-scored at the end of M8 (M8-10) in a new column |
| Method | Each row is 0 (fails), 1 (partly), 2 (meets). Scored by looking at the seeded shop at 390 px and 1280 px in the browser, at the saved screenshots (`apps/e2e/visual/baselines/`), and at the accessibility tree; F1 and F2 from the measured numbers below. The target at M8-10 is at least 85% of the maximum (67 of 78) and no zero in a row that DOC-06.14 marks Must |

## Result

**Baseline: 34 of 78 (44%).** Rows scored 0: 16 of 39. The weakest groups are search (2 of 10), the visual system (1 of 6), navigation (5 of 12) and the category-first rows N7 to N9 (1 of 6); the strongest are accessibility (5 of 6), performance (3 of 4) and listings (7 of 14); the product page is in the middle (6 of 12: sizing and gallery are good, delivery and reviews are not).

## Rows

| Row | Check | Score | Evidence |
|---|---|---|---|
| N1 | Every top category is reachable from the header on desktop in one interaction | 0 | Header holds New and Sale only (`first-run` test fails as designed) |
| N2 | Parent categories in menus are links, with a "View all" | 0 | No category menu exists |
| N3 | The menu opens by keyboard, closes with Escape, focus returns | 1 | The mechanism exists (click panel, drawer, focus return) but the seeded menu has no children to exercise it |
| N4 | The menu works with JavaScript off | 2 | Links are in the server HTML |
| N5 | On a phone, categories are reachable in two taps | 0 | The drawer lists New and Sale; categories only via a page's filters |
| N6 | Cart count, wishlist and search are visible without scrolling | 2 | Header icons at both widths |
| S1 | Suggestions show products with pictures and prices | 0 | None; search is an icon that opens a bare field |
| S2 | Suggestions include categories | 0 | None |
| S3 | Arrows, Enter and Escape work; the count is announced | 0 | None |
| S4 | An empty search box offers recent and popular searches | 0 | None |
| S5 | The no-results page offers a way forward | 2 | Picture `search-none`: spelling hint, WhatsApp button, new arrivals |
| L1 | Size filter is first and open | 1 | Open, but second after Type |
| L2 | Applied filters are visible and removable | 2 | Chips in the listing |
| L3 | Cards show colour swatches | 1 | Dots appear only on products that have colourways |
| L4 | Cards show price, discount, rating and a stock cue | 1 | Price, discount, badges; no rating, no "only N left" |
| L5 | Quick add works with a size choice | 0 | Cards have no add control |
| L6 | Scroll position kept; Load more, not endless scroll | 2 | Listing memory and a "Load more" link |
| L7 | Density switch works and is remembered | 0 | None |
| P1 | Sizes are buttons; out-of-stock sizes are marked before selection | 2 | Chips; sold-out sizes named and marked |
| P2 | Delivery cost and days for the customer's city are on the page | 0 | A fixed list only |
| P3 | Free-delivery information is on the page, not only the banner | 1 | One list line, not tied to the city or the basket |
| P4 | Gallery: zoom, enough pictures, a picture on a model | 1 | Zoom and thumbnails exist; the demo has no model pictures |
| P5 | Reviews: distribution, fit, photos | 1 | List and photos; no distribution or fit summary |
| P6 | Trust points link to real policies | 1 | The points are text without links |
| C1 | Free-delivery progress in the bag | 0 | None |
| C2 | Checkout errors: focus on the first, count announced | 2 | Done 2026-10-15 (test 21) |
| H1 | Hero text is readable on every slide | 2 | Fixed 2026-10-15 (test 22); measured on the demo pictures only |
| H2 | The home page has category entry points above the fold on a phone | 0 | None shown on the seeded shop |
| V1 | Spacing and type follow the written scale | 0 | No written scale yet (DOC-06.15 §4.1 is the draft) |
| V2 | Motion is subtle and stops with reduced motion | 1 | Short fades; no hover choreography; reduced motion respected |
| V3 | All pictures are real photographs | 0 | Generated placeholders |
| A1 | axe has no violations on every page | 2 | Sweep test 18 |
| A2 | 320 px reflow without sideways scroll | 2 | Sweep test 18 |
| A3 | Targets are 44 px and focus is visible | 1 | Focus visible everywhere; target sizes not audited per control |
| F1 | Initial JavaScript within the ceilings | 2 | 233.6 to 261.5 kB gzip against 240 to 268 |
| F2 | LCP, CLS and INP within the budgets | 1 | Lighthouse (phone profile, median of 3): LCP 3.94 s home, 4.02 s listing, 3.92 s product, 3.56 s bag, all inside the ceilings (4.5 / 4.5 / 4.5 / 4.0) but **not the 2.5 s target**; CLS 0.000; TBT 45 to 107 ms; no third-party requests |
| N7 | A category with no products, or hidden, is shown nowhere | 0 | "Test" (empty) is in the public tree; any automatic menu would show it |
| N8 | Every top category appears twice on the home page | 0 | None appears (tiles need pictures the seed lacks) |
| N9 | A category landing page shows its sub-categories with pictures | 1 | Sub-category chips without pictures (picture `category-landing`) |

## Numbers recorded

| Measure | Baseline |
|---|---|
| Initial JavaScript, gzip | Home 233.6, listing 239.9, product 261.5, bag 243.7, checkout 245.2 kB |
| Lighthouse, phone profile, median of 3 | Home LCP 3.94 s, TBT 45 ms; listing 4.02 s, 58 ms; product 3.92 s, 107 ms; bag 3.56 s, 49 ms; CLS 0.000 everywhere; time to first byte 12 to 81 ms; transferred JS 266 to 298 kB, fonts 87 kB, images 0 to 76 kB |
| Admin initial JavaScript | 222.3 kB at sign-in, 227.7 at the dashboard (budget 230) |
| Visual baselines | 37 pictures, 12 pages at 390, 768 and 1280 px; repeatable on a fresh database (36 of 36 pass twice) |
| Requirements with a test tagged by id | 22 of 136 Must functions (`node scripts/check-requirements.mjs --list`) |
| Dead admin controls | 11 (`apps/storefront/test/admin-coverage.map.js`) |
| End-to-end suite | 40 journeys and checks pass on a fresh database (before M8-01 added its own) |

## Changelog

| Date | Change |
|---|---|
| 2026-10-16 | Created from M8-01 |

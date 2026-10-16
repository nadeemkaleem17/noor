# 06.14 — Site blueprint: every surface and function of the shop, researched, with IDs

| Field | Value |
|---|---|
| ID | DOC-06.14 |
| Title | The complete requirements catalogue for storefront v2 |
| Status | Draft, written 2026-10-16 at the owner's request ("research each small to large part and embed all functionalities"), for approval |
| Owner | Tech lead |
| Depends on | DOC-06.11 (v2 plan and research), DOC-06.12 (admin coverage), DOC-06.13 (navigation and categories) |
| Relationship | **This is the one list of what the shop must do.** DOC-06.11 §5 is its summary; DOC-06.13 is the detail for navigation, home and category pages and wins where they differ; DOC-06.1 to 06.10 describe v1 and are superseded wherever this document says otherwise |

## 1. How to read this

- **One row = one function with an ID.** Every *Must* row gets a test (end-to-end, unit or visual) that cites its ID; M8-01 builds a check that fails when a Must ID has no test. The UX scorecard of DOC-06.11 §8.3 is these rows, scored.
- **Pri**: **M** must ship in M8; **S** should ship if M8 time allows; **L** later (written down so it is not lost; needs the owner's go-ahead or a new admin feature).
- **Today**: **Y** the shop has it; **P** partly; **N** not at all. Checked against the code and the live shop on 2026-10-16.
- **Basis** tags: **BM** Baymard research ([articles](https://baymard.com/research)), **AP** W3C ARIA Authoring Practices, **WC** WCAG 2.2, **DW** Shopify Dawn code, **KH** Khaadi, **SP** Sapphire, **OF** Outfitters (observed live 2026-10-15/16), **PK** Pakistan e-commerce practice (cash on delivery, trust), **OW** owner rule or decision. Source quality is stated in DOC-06.11 §3.1 and §3.3; vendor-blog numbers are never used as facts.
- **Fixed rules for every surface**: works without JavaScript first; English only (Urdu stays off); money is integer paisa shown as "Rs 3,490"; no third-party scripts or requests (E2E-17); every function has a loading, empty and error state; keyboard-only and screen-reader usable; 44 px touch targets; respects reduced motion.

## 2. The surfaces

Order: the shell, discovery (search, home, listings), the product, the basket and the order, after-sale, content and trust, then the cross-cutting qualities.

### 2.1 Global shell (SH)

Research: header chrome should be quiet and reachable (DW header options: logo left or centre, hide on scroll down, count badge read by screen readers); Pakistani leaders put **Track** in the top strip (KH) and a floating chat (all three).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| SH-01 | Announcement bar: staff text and link, dismissible, remembers the dismissal for the session | M | Y | OW |
| SH-02 | Rotating notices with start and end dates (up to 5), paused on hover and focus, with a pause control | M | Y | WC 2.2.2 |
| SH-03 | Utility strip: **Track order** and **WhatsApp** links beside the announcement | M | P | KH |
| SH-04 | Header per DOC-06.13 §4 (category navbar, mega and simple panels, search, wishlist, bag) | M | P | BM, AP, KH |
| SH-05 | Header honours the Appearance settings: layout (left or centre) and "keep at the top"; hides when scrolling down and returns when scrolling up | M | Y | DW |
| SH-06 | Logo: light and dark variants from Store settings; tagline shown in the footer; uploaded favicon wins over the built-in one | M | P | DOC-06.12 |
| SH-07 | Bag icon with live count (hydrated), count read by screen readers, no cart data in cached HTML | M | Y | DW |
| SH-08 | Mini-bag drawer (slides in after an add, from the bag icon) per CT-01 to CT-10 | M | Y | BM |
| SH-09 | Floating WhatsApp button (staff number, prefilled text), above the buy bar on product pages, hidden at checkout | M | Y | PK |
| SH-10 | Footer per DOC-06.13 §7 (Shop, Collections, Help, Company; contact; social; payment methods; "About" text; copyright) | M | P | SP, KH |
| SH-11 | Toasts for add to bag, wishlist, errors: polite live region, auto-dismiss, action button (Undo, View bag) | M | P | WC 4.1.3 |
| SH-12 | Page transitions: view transitions between routes where supported, skeletons for deferred blocks, no layout shift | S | N | OW |
| SH-13 | 404, 500 and offline pages in the shop's voice with search, top categories and WhatsApp | M | P | BM |
| SH-14 | "Shop closed / maintenance" mode from a Store setting: banner or full page, orders paused with a clear message | S | N | OW |
| SH-15 | Skip link, landmarks, one h1 per page, focus visible everywhere | M | Y | WC |
| SH-16 | Back-to-top control on long listings (appears after two screens) | S | N | pattern |
| SH-17 | Cookie banner: **not needed** because the shop sets only functional cookies (cart, wishlist) and loads no third-party tools; the privacy page says so | M | Y | OW |

### 2.2 Search (SR)

Research: only 19% of shops get autocomplete right; its value is guiding shoppers to better queries and the right scope (BM); Dawn's predictive search uses arrow keys, `aria-activedescendant`, a status line with the result count, a cache by query, request cancelling (DW).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| SR-01 | Search field in the header (inline on wide screens, full-width overlay on phones); plain GET form to `/search` without JavaScript | M | P | DW |
| SR-02 | Suggestions: up to 5 products (picture, name, price), matching categories and collections, "See all N results for ..." | M | Y | BM, DW |
| SR-03 | Keyboard and screen reader: arrows, Enter, Escape, `aria-activedescendant`, live result count, 150 ms debounce, cancel in-flight requests, cache by normalised query | M | Y | DW, AP |
| SR-04 | Empty field shows recent searches (this browser only, deletable) and popular searches (staff-curated list) | M | Y | BM |
| SR-05 | Matches SKUs and handles first; handles typos and synonyms (exists server side) | M | Y | OW |
| SR-06 | Results page: count, sort, the same filters as a listing, category chips to narrow, "did you mean" | M | P | BM |
| SR-07 | No-results page: the query kept in the box, suggestions, top categories, popular searches, WhatsApp us; zero-result queries logged (exists) | M | P | BM |
| SR-08 | Search is `noindex` and private-cache (exists) | M | Y | SEO |

### 2.3 Home page (HM) — composition in DOC-06.13 §5

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| HM-01 | Hero campaign carousel: readable text on every slide (white on a measured scrim), one h1, pause control, swipe on phones, preloaded first image | M | Y | WC 1.4.3 |
| HM-02 | Shop by category: round pictures for every visible top category, then collections; sideways scroll on phones | M | P | KH, 06.13 |
| HM-03 | New in with tabs per top category (All, Women, Men, Kids, Footwear, Accessories), "View all" per tab | M | P | OF, 06.13 |
| HM-04 | Featured collections as large tiles | M | P | KH |
| HM-05 | Shop by occasion tiles (from the Occasion filter) | S | N | 06.13 |
| HM-06 | Category spotlight blocks for the top categories not yet led, with four product thumbnails | M | N | 06.13 |
| HM-07 | Bestsellers with the same tabs | M | P | KH |
| HM-08 | Promo band and editorial band (staff content) | M | Y | OW |
| HM-09 | Customer reviews highlight (best recent approved reviews with photos) | S | N | PK |
| HM-10 | Trust strip: free-delivery threshold, cash on delivery, return days, WhatsApp support, each linking to its policy | M | Y | PK |
| HM-11 | "Shipping charges / Track your order" blocks in the lower page | S | N | KH |
| HM-12 | Every section omitted when empty; the page never shows an empty frame | M | Y | OW |
| HM-13 | The coverage invariant of DOC-06.13 §3 holds on the seeded data | M | N | OW |

### 2.4 Listings: categories, collections, new, sale (LS) and the product card (PC)

Research: size filter first and open (90% then filter by size) (BM); applied filters visible (BM); swatches on mobile cards (57% lack) (BM); avoid quick-view overlays (BM) — a size chooser on the card is not a quick view of the product; keep scroll position, use Load more (BM); hover second picture, skip when single (research); density switch (KH).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| LS-01 | Landing pages and leaf pages per DOC-06.13 §6; breadcrumb; title, description, count | M | P | BM |
| LS-02 | Filters: size first and open, then price, colour (swatch), fabric, occasion, pieces and the category's own; counts; greyed zero values; multi-select; search inside long lists | M | P | BM |
| LS-03 | Filter UI: left column on wide screens, bottom sheet on phones with "Show N items" and Clear; real GET form so it works without JavaScript | M | Y | BM |
| LS-04 | Applied-filter chips with remove and "Clear all"; the address holds the state | M | Y | BM |
| LS-05 | Sort: featured, newest, best selling, price low-high and high-low, biggest discount | M | P | BM |
| LS-06 | Density switch (phone 1 or 2; desktop 3 or 4), remembered | S | N | KH |
| LS-07 | Load more (link, works without JavaScript) with count "Showing 24 of 411"; scroll position restored on return | M | Y | BM |
| LS-08 | Round sub-category and "first filter" chips above the grid | M | P | KH |
| LS-09 | Empty and no-match states with a way out (clear filters, siblings, popular) | M | P | BM |
| LS-10 | Sale page shows the discount on each card; New page sorted newest | M | Y | OW |
| LS-11 | Category description text under the grid for SEO, collapsible | S | P | SEO |
| LS-12 | Sticky filter and sort bar while scrolling | M | N | KH |
| PC-01 | Card: picture (3:4), name, price, compare-at with "-x%", New and Sale and Sold out and Low stock badges | M | Y | DW |
| PC-02 | Second picture on hover (fine pointers) and swipe dots on touch; none for single-picture products | M | P | research |
| PC-03 | Colour swatches (up to 5 plus "+N"); a swatch links to that colourway | M | P | BM |
| PC-04 | Fabric/technique line from the product subtitle ("Printed \| Light khaddar") | M | N | KH |
| PC-05 | Rating stars with count (text label for screen readers), only with 3 or more reviews | S | N | DW |
| PC-06 | Heart (wishlist) with filled state, toggled without leaving the page, announced | M | Y | KH |
| PC-07 | Quick add: opens a size chooser on the card (out-of-stock sizes struck through), adds without leaving the page and opens the mini-bag | M | N | KH, BM |
| PC-08 | "Only N left" when stock is at or under the low-stock threshold | M | N | DW |
| PC-09 | The link's name is the product name plus its badge, once (no repeated picture text) | M | Y | DW |
| PC-10 | Skeleton card while a deferred block loads | S | P | OW |

### 2.5 Product page (PD)

Research: apparel needs fit and measurement detail (82% of shops lack enough sizing information) (BM); size buttons, not drop-downs (BM); show out-of-stock sizes early (39% found late) (BM); people on models, in-scale pictures, zoom (BM); estimated shipping cost on the page (43% lack) and "free shipping" not only in the banner (BM); multi-piece suits detailed per piece with their own fit and fabric (KH).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| PD-01 | Gallery: thumbnails (side column on wide screens, dots on phones), swipe, zoom on hover and tap, keyboard arrows, at least one picture of a model and one detail picture shown first | M | P | BM, KH |
| PD-02 | Breadcrumb with the full category path; eyebrow (brand or fabric line), h1, subtitle, SKU, price with compare-at and "-x%" | M | Y | KH |
| PD-03 | Size chips with availability: sold-out sizes struck through and named, low-stock per size, size guide link beside them | M | P | BM |
| PD-04 | Colourway chips linking to sibling products | M | Y | OW |
| PD-05 | Quantity, add to bag, **Add to wishlist**, WhatsApp "ask about this"; button states: Select size, Add to bag, Sold out, Notify me, Made to order | M | Y | OW |
| PD-06 | **Delivery block**: city chooser (remembered), delivery days, fee for that city, free-delivery threshold and how much is missing, dispatch promise; also the made-to-order lead time | M | N | BM |
| PD-07 | Sets and multi-piece suits: each piece with its own fit, fabric, size and price; buy the set or one piece | S | P | KH |
| PD-08 | Bundles ("complete the look") with a total and one add | S | P | OW |
| PD-09 | Made-to-order and custom size form with measurements, deposit and lead time explained | M | Y | OW |
| PD-10 | Trust points with real content next to the button: Cash on delivery, N-day returns, WhatsApp support, each linking to its policy | M | P | PK |
| PD-11 | Sections: Details, What's included, Fabric and care, Size and fit (garment measurements and "model is 5'8" wearing S"), Delivery and returns; open "Details" by default; native `<details>` | M | P | BM |
| PD-12 | Reviews block per RV-* | M | P | BM |
| PD-13 | "You may also like", "Complete the look", "Recently viewed", "More from <category>" rails | M | P | KH |
| PD-14 | Sticky buy bar on phones once the real button leaves the screen; sticky buy box on wide screens | M | P | research |
| PD-15 | Share: copy link, share sheet on phones, WhatsApp share with the product picture preview | S | N | PK |
| PD-16 | Notify me when back in stock (exists) with the size chosen | M | Y | OW |
| PD-17 | Stock cue and "Only N left" honest (from the real count), never invented urgency | M | Y | OW |
| PD-18 | Product video or short clip on the gallery | L | N | PK (video is hard to fake) |
| PD-19 | Structured data Product + Offer + AggregateRating + BreadcrumbList, canonical, OG image for WhatsApp previews | M | Y | SEO |
| PD-20 | Size recommender ("your height and weight") on the size guide, for stitched wear | L | N | BM (returns) |

### 2.6 Reviews (RV)

Research: rating distribution and a fit sub-score (BM); page through reviews that have customer photos (BM); about half of apparel shoppers look for size accuracy in reviews (BM).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| RV-01 | Average, count and the five-bar distribution (data `byStar` exists) | M | N | BM |
| RV-02 | Fit summary: "Runs small / true to size / large" from the fit notes | M | N | BM |
| RV-03 | Review list: photos first option, sort (newest, highest, lowest, with photos), filter by star and by size bought, "Load more reviews" | M | P | BM |
| RV-04 | Photo gallery of all review pictures, opening each review | S | N | BM |
| RV-05 | Review form (exists): rating, text, size bought, fit, photos, name display choice; arrives through the order link | M | Y | OW |
| RV-06 | "Verified buyer" label (a review is tied to an order line) | M | Y | PK |
| RV-07 | Staff reply shown under a review | L | N | PK |
| RV-08 | Review request: the order page after delivery shows "Review your items"; WhatsApp reminder text staff can send from the order screen | S | P | PK |

### 2.7 Wishlist and recently viewed (WL)

Research: save first, sign in later; guest storage is fragile, say so; keep the control visible on cards and pages (vendor docs, directional).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| WL-01 | Heart on cards and the product page; the wishlist page lists items with price, stock and "Add to bag"; works from a cookie, no account | M | Y | OW |
| WL-02 | The page says where the list lives ("saved on this device") and offers **share my wishlist** by link | S | N | research |
| WL-03 | Price drop and back-in-stock marks on saved items | S | N | research |
| WL-04 | Count in the header; announced when changed | M | Y | WC |
| WL-05 | Recently viewed rail (exists) with a clear control | S | Y | OW |

### 2.8 Bag and mini-bag (CT)

Research: top abandonment reasons are extra costs, forced accounts, long checkout, unclear pricing and distrust (BM via secondary sources); the cart should show the total and let people edit (BM); a free-delivery progress bar plausibly lifts order value (vendor evidence, test it).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| CT-01 | Lines: picture, name, size/colour, custom-size note, unit price, quantity stepper, remove, line total; edit size without removing | M | P | BM |
| CT-02 | Stock and price changes explained on the line ("price changed", "only 2 left") and never blocking silently | M | Y | BM |
| CT-03 | Free-delivery progress ("Add Rs 1,200 more for free delivery") from the real zone threshold | M | N | research |
| CT-04 | Delivery estimate by city in the bag (fee and days), so no surprise at checkout | M | N | BM |
| CT-05 | Promo code box with clear errors (minimum spend, expired); applied code removable; saving shown | M | Y | OW |
| CT-06 | "You may also like" and "Complete the look" in the mini-bag | S | N | DW |
| CT-07 | Move to wishlist from a line | S | N | BM |
| CT-08 | Order summary: subtotal, discount, delivery, total, cash to pay on delivery | M | Y | BM |
| CT-09 | Cart survives days (cookie token) and merges nothing (guest only); expired lines are marked | M | Y | OW |
| CT-10 | Empty bag state with top categories and the wishlist | M | P | BM |
| CT-11 | Order note (gift message or instruction) | S | N | pattern |

### 2.9 Checkout (CK)

Research: guest checkout must be the most prominent option (47% of shops fail) (BM); average 11.3 fields, aim for the fewest (BM); show why a phone number is needed (39% do not) (BM); address entry: auto-detect city from postal code, validate, keep it short (BM); mobile keyboards by field type, autocorrect off for names and addresses (BM touch-keyboard cheat sheet); retain data after errors (BM); Pakistan: cash on delivery is the trust anchor, confirm orders before dispatch by call or WhatsApp, keep refusals low (PK).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| CK-01 | One page: contact, delivery, payment, summary; no account step at all | M | Y | BM |
| CK-02 | Fields: full name, mobile (explained: "we confirm your order on this number"), email optional, city, address, landmark optional, notes optional; nothing else | M | Y | BM |
| CK-03 | Mobile number: Pakistani formats accepted (0300 1234567, +92 300 ...), normalised, `inputmode=tel`, autocomplete | M | Y | PK |
| CK-04 | City as a searchable list with the major cities first; the zone's fee and delivery days appear at once | M | P | BM |
| CK-05 | Delivery methods by city with price and days; one preselected | M | Y | BM |
| CK-06 | Payment: cash on delivery with its description; high-value or flagged orders get a clear message and a WhatsApp alternative | M | Y | PK |
| CK-07 | Order summary sticky on wide screens, collapsible on phones; total always visible near the button | M | P | BM |
| CK-08 | Errors: first invalid field focused, count announced, every field's message linked (done 2026-10-15), typed values kept | M | Y | BM, WC |
| CK-09 | Browser autofill and correct keyboards (`autocomplete`, `inputmode`, `enterkeyhint`), no autocorrect on names and addresses | M | P | BM |
| CK-10 | Idempotent placing: double tap or a lost connection never makes two orders; the same message on retry | M | Y | OW |
| CK-11 | Trust line at the button: "Pay when it arrives. We confirm every order on WhatsApp or by phone before dispatch." with the return policy link | M | P | PK |
| CK-12 | Optional marketing consent unticked, worded plainly (exists) | M | Y | OW |
| CK-13 | "Save my details on this device" (remember name, number, address in this browser) | S | P | BM |
| CK-14 | Order review step on phones is not added: one scroll, one button | M | Y | BM |
| CK-15 | Prepaid options (card, bank transfer, wallets) with a small incentive | L | N | PK (owner has chosen COD only at launch) |

### 2.10 Order confirmation, order page, tracking (OR)

Research: the order page answers "where is my order?" first; show the dates and what can still be changed; give the carrier link; send proactive updates; link to returns from the page (BM, vendor guides). Pakistan: customers expect a confirmation call or WhatsApp.

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| OR-01 | Confirmation: thank-you with masked name, order number, what happens next ("we will call or WhatsApp you on 0345 ••••301"), copy link, add to home screen hint | M | Y | PK |
| OR-02 | Status timeline (placed, confirmed, packed, dispatched, delivered) with dates; "cancelled" and "refused" explained | M | P | BM |
| OR-03 | Estimated delivery window; courier name and **tracking number with a link to the courier's page** once dispatched | M | P | BM |
| OR-04 | What you can still do and until when: cancel (before dispatch), switch to cash on delivery, edit address via WhatsApp | M | Y | BM |
| OR-05 | Track page: order number and mobile; the same page as the link; the same message for wrong phone and unknown number (anti-enumeration, exists) | M | Y | OW |
| OR-06 | Print invoice view | M | Y | OW |
| OR-07 | **Buy again**: add all lines of a past order to the bag (stock permitting) | S | N | pattern |
| OR-08 | Order messages by WhatsApp or SMS at placed, confirmed, dispatched, delivered (needs a provider; today they are logged and skipped) | S | P | PK |
| OR-09 | Review prompt after delivery (RV-08) | S | P | PK |
| OR-10 | WhatsApp help button prefilled with the order number (number only, no personal data) | M | Y | OW |
| OR-11 | Share the order page (copy link) | S | N | pattern |

### 2.11 Returns and exchanges (RT)

Research: 54% of shops have severe returns usability issues; returns UI matters for retention (BM); exchanges can be promoted over refunds (vendor tactic, test it). Pakistan stores allow 3 to 7 days (DOC-06.11 owner list). Today the customer cannot ask for a return in the shop; staff handle it from the admin order screen.

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| RT-01 | Returns policy page with the window, conditions, what is not returnable (made to order), how refunds work (cash on delivery: refund method), and how to start | M | P | BM |
| RT-02 | **Return or exchange request** from the order page within the window: choose items, reason, exchange for another size or refund, photos for defects; creates a request staff see in the admin | S | N | BM |
| RT-03 | Request status visible on the order page; messages by WhatsApp | S | N | BM |
| RT-04 | Admin: returns queue, approve or decline with a reason, pickup scheduled, refund recorded (new admin screen) | S | N | BM |

### 2.12 Content, help and trust pages (CM, TR)

Research: Pakistani buyers worry about scams and photos that differ from the product; trust comes from COD, clear policy, real contact details and resolution speed (PK sources); Sapphire's footer groups Contact us, Customer care, Information, Newsletter (SP); Khaadi surfaces shipping charges, order tracking and store finder blocks (KH).

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| CM-01 | About us: who, where, how orders are made and sent, a real address and a photograph | M | P | PK |
| CM-02 | Contact: phone, WhatsApp, email, address with map link, hours, a form or WhatsApp button; response time promised | M | P | PK |
| CM-03 | Shipping and delivery: fees by zone table, days, free threshold, couriers named (data from the shipping settings, not typed twice) | M | P | BM |
| CM-04 | Returns and exchange (RT-01), privacy, terms (drafted; need the owner's real details and a lawyer's read) | M | P | OW |
| CM-05 | FAQ: ordering, cash on delivery and confirmation calls, sizes, delivery, returns, care; also FAQPage data | M | N | PK |
| CM-06 | Size guide page and drawer (exists) with garment measurements and "how to measure" | M | Y | BM |
| CM-07 | Fabric and care guide (lawn, khaddar, chiffon, silk...) linked from products | S | N | research |
| CM-08 | Lookbook or journal for campaigns | L | N | KH |
| TR-01 | Trust badges row used in footer, product page and checkout: Cash on delivery, N-day returns, WhatsApp support, real address | M | P | PK |
| TR-02 | Site-wide rating and review count on the home page and the About page when there are enough reviews | S | N | PK |
| TR-03 | "Find us" block when the owner has a physical shop (staff text; hidden otherwise) | L | N | KH |
| TR-04 | Newsletter / WhatsApp updates sign-up with explicit consent, double opt-in for email | L | N | SP |

### 2.13 Promotions and marketing (MK)

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| MK-01 | Offers page listing active public promo codes in words ("10% off over Rs 5,000: EID10") with a copy button; a promo flagged "public" in the admin | S | N | DOC-06.12 |
| MK-02 | Sale page and sale badges (exists); a countdown only for a real end date, never a fake timer | M | P | OW |
| MK-03 | Back-in-stock alerts (exists, product page); a back-in-stock list the shop owner can send | S | P | OW |
| MK-04 | Abandoned bag reminder by WhatsApp with consent | L | N | PK |
| MK-05 | Gift cards, loyalty points, referral codes | L | N | pattern |

### 2.14 Phone (MB)

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| MB-01 | Primary actions in the thumb zone; sticky buy bar; optional bottom bar (DOC-06.13 §4.4) | M | P | BM |
| MB-02 | Swipe gallery with thumbnails signposted (76% of mobile sites lack thumbnails) | M | P | BM |
| MB-03 | Forms use the right keyboard, no zoom on focus (font size at least 16 px), autofill works | M | P | BM |
| MB-04 | Works at 320 px without sideways scroll; tested on a real phone (M7-06) | M | Y | WC |
| MB-05 | Install to home screen (web app manifest, icons) without offline claims | S | N | PK |
| MB-06 | Saves data on slow networks: images sized to the screen, no autoplay video | M | P | PK |

### 2.15 Cross-cutting qualities

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| AX-01 | WCAG 2.2 AA on every page (axe in CI); 320 px reflow; 44 px targets; visible focus; reduced motion | M | Y | WC |
| AX-02 | Menus and panels follow the disclosure pattern; dialogs trap and return focus | M | P | AP |
| AX-03 | Screen-reader pass with NVDA and TalkBack signed by a person (M7-02) | M | N | WC |
| PF-01 | JavaScript ceilings of DOC-06.10 §2 and DOC-06.11 §7; LCP, CLS, INP budgets; images AVIF/WebP with `srcset`, first image preloaded; fonts self-hosted | M | Y | OW |
| PF-02 | Every new feature loads on first use or is HTML and CSS | M | P | OW |
| SE-01 | Product, Offer, Review, Breadcrumb, Organization and WebSite schema; sitemaps; canonical and noindex rules; OG images for WhatsApp previews | M | Y | SEO |
| SE-02 | FAQ schema; category ItemList; Google Merchant feed | S | P | SEO |
| AN-01 | Web vitals and client errors to our own endpoint (exists) | M | Y | OW |
| AN-02 | Three first-party counters without personal data: search used, menu used, quick add used | S | N | OW |
| SC-01 | No third-party requests (test E2E-17); order links are tokens; rate limits per visitor (exists) | M | Y | OW |
| SC-02 | Staff content sanitised (Markdown allow-list, safe links) | M | Y | OW |

### 2.16 Visual design system (VD)

Research: premium fashion pages are quiet chrome and large photography (KH, SP, OF); consistent ratio, no card borders, generous whitespace; motion subtle.

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| VD-01 | Type scale written in tokens: display, h1 to h4, body, small, caption; Playfair for headings only, Inter for text; line heights and sizes by breakpoint | M | N | OW |
| VD-02 | Spacing scale (4 px base) and section rhythm (large gaps between sections, tight inside) | M | N | OW |
| VD-03 | Colour roles from the theme; **no colour class that is not a token**; hero text always white on a measured scrim; contrast gate kept | M | P | WC |
| VD-04 | Imagery: 3:4 for products, 4:5 on phones for heroes, 16:9 on wide screens; art direction and focal point per hero slide | M | P | KH |
| VD-05 | Icons: one set (Lucide), 24 px, 1.5 px stroke | M | Y | OW |
| VD-06 | Buttons: one primary per view, secondary, text; states (hover, focus, pressed, loading, disabled with a reason) | M | P | OW |
| VD-07 | Motion: 150 to 250 ms, ease-out; menus, cards, drawers; view transitions; stopped by reduced motion | S | P | OW |
| VD-08 | Empty states and illustrations kept simple and in brand tone | S | P | OW |
| VD-09 | Microcopy: sentence case, plain English, "Add to bag" or "Add to cart" chosen once and used everywhere, no "please", no exclamation marks on system text | M | P | OW |
| VD-10 | Skeletons and image placeholders in the page colours; no layout shift | M | P | WC |

### 2.17 Content operations (OP)

The best interface fails on weak content. These rules are for staff and are checked in the admin.

| ID | Requirement | Pri | Today | Basis |
|---|---|---|---|---|
| OP-01 | Product standard: title (what it is), subtitle (technique and fabric), 4 or more pictures (front, back, detail, on a model), garment measurements, fabric, care, fit note, SKU | M | N | BM |
| OP-02 | A "Shop-ready" checklist in the product editor and a list of products that fail it before publishing | S | N | OW |
| OP-03 | Category standard: picture, 1 to 2 sentence description, 5 to 8 words of SEO text | M | N | BM |
| OP-04 | Photography brief delivered (3:4, neutral background, consistent light, one on a model) | M | N | BM, KH |
| OP-05 | Alt text for every picture: what it shows, not the product name repeated | M | P | WC |
| OP-06 | Launch checklist: real contact, fees, return days, policy pages read, "Test" category removed, favicon and logos uploaded | M | P | OW |

## 3. Counts

Counted from the rows above (184 functions): **136 Must, 39 Should, 9 Later**. Today the shop has **59 of them complete (Y), 66 partly (P) and 59 not at all (N)**.

| Area | Must | Should | Later |
|---|---|---|---|
| Shell SH | 14 | 3 | 0 |
| Search SR | 8 | 0 | 0 |
| Home HM | 10 | 3 | 0 |
| Listings LS and cards PC | 18 | 4 | 0 |
| Product PD | 15 | 3 | 2 |
| Reviews RV | 5 | 2 | 1 |
| Wishlist WL | 2 | 3 | 0 |
| Bag CT | 8 | 3 | 0 |
| Checkout CK | 13 | 1 | 1 |
| Order OR | 7 | 4 | 0 |
| Returns RT | 1 | 3 | 0 |
| Content CM and trust TR | 7 | 2 | 3 |
| Marketing MK | 1 | 2 | 2 |
| Phone MB | 5 | 1 | 0 |
| Cross-cutting AX, PF, SE, AN, SC | 9 | 2 | 0 |
| Visual VD | 8 | 2 | 0 |
| Content operations OP | 5 | 1 | 0 |

M8 builds every Must and as many Should as time allows; the Later rows need the owner's go-ahead. A script (`apps/storefront/test/requirements.test.js`, M8-01) counts these rows, so this table cannot drift from the list.

## 4. Gaps this catalogue adds to the task list

New work that is not in the ten M8 tasks of DOC-06.11 §7 and is added to them in the roadmap:

| Added to | Content |
|---|---|
| M8-04 Search | SR-01 to SR-07 as one task |
| M8-06 Product page | PD-03, PD-06, PD-10, PD-11, PD-15, RV-01 to RV-04, PD-07 (sets) |
| M8-07 Bag and checkout | CT-03, CT-04, CT-06, CT-07, CT-11, CK-07, CK-09, CK-11, CK-13 |
| **M8-11 After-sale** (new) | OR-03, OR-07, OR-08 (with a provider decision), RT-01 to RT-04 (customer request and the admin queue) |
| **M8-12 Content and trust pages** (new) | CM-01 to CM-07, TR-01, TR-02, MK-01 (offers page and the "public promo" admin flag) |
| M8-09 Design system | VD-01 to VD-10, SH-12, MB-05, MB-06 |
| M8-10 Closure | OP-01 to OP-06, AX-03, the scorecard |

## 5. Owner decisions still open

1. Approve the catalogue, or strike or promote rows (especially the *Should* and *Later* ones).
2. Returns: do you want customers to **request** returns in the shop (RT-02 to RT-04), or keep it a WhatsApp conversation? (The first costs an admin screen and a status flow.)
3. Order messages (OR-08): which provider for WhatsApp or SMS, and the cost you accept; until then they stay logged and skipped.
4. "Add to bag" or "Add to cart" (the shop says cart; most Pakistani brands say bag).
5. The four decisions of DOC-06.13 §11, the photography answer, the optional designs and the delivery fees.

## 6. Changelog

| Date | Change |
|---|---|
| 2026-10-16 | Created: 17 surfaces, 184 functions, from the research of DOC-06.11 §3 plus checkout, cart, order tracking, returns, reviews, wishlist, size and fit, Pakistan trust and mobile research, and the live pages of Khaadi, Sapphire and Outfitters |

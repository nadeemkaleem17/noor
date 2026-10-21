# 06.15 — Design system v2: typography, colour, layout, imagery, motion and UI behaviour

| Field | Value |
|---|---|
| ID | DOC-06.15 |
| Title | The look and the behaviour of the storefront, specified with evidence |
| Status | Draft, written 2026-10-16 at the owner's request ("deep analysis of UI, behaviour, typography, colour, all things"), for approval |
| Owner | Tech lead |
| Depends on | DOC-06.11 (v2 plan), DOC-06.13 (navigation), DOC-06.14 (function list, rows VD-*), DOC-04 (design system v1: tokens.md, components.md, patterns.md) |
| Relationship | Replaces the storefront parts of DOC-04 `tokens.md` §4 where it differs; the admin keeps DOC-04 as it is |

## 1. Evidence

### 1.1 What five leading Pakistani brands actually use (measured in the browser, 2026-10-15/16)

| Brand | Type | Navigation | Headings | Page and text colours | Corners |
|---|---|---|---|---|---|
| Khaadi | Custom sans ("Khaadi"), Arial fallback | Uppercase 14 px, weight 500; Sale in orange `#FD6500` | h1 25 px / 30, weight 400 | White page; text `#2D2B2A` and `#212529` | 2 px |
| Sapphire | Montserrat (400 to 700) | 16 px, mixed case, black | h1 40 / 48, weight 500; h2 32 | White; pure black text | 3 px |
| Outfitters | Neue Haas Grotesk Display (Helvetica family) | Uppercase 16 px, weight 500, tracking 0.6 px | h1 30 / 39, weight 400; body 15 px, tracking 0.6 px | White; text `#121212` at 75% | 0 px |
| Maria B | Montserrat | Uppercase 12 px | h1 14 px uppercase 600; h2 18 | White; `#121212` | 0 px |
| Sana Safinaz | Quicksand (body) and Outfit (headings) | Uppercase 14 px, weight 600 | h1 36, weight 400 | White; black | 0 px |

**Pattern:** every one is **all sans-serif**; near-black on white; uppercase short navigation labels at 12 to 16 px; headings at weight 400 to 500 (not bold); corners between 0 and 3 px; the chrome is almost invisible and photography does the talking. Some of their text measured as small as 10 to 12 px (product names and prices on the listing pages): that is a weakness to beat, not copy. Header heights: 51 to 88 px.

### 1.2 Open-source themes read (Shopify Dawn, the most used)

Durations 100, 200, 300, 500 ms; one easing `cubic-bezier(0, 0, 0.3, 1)`; breakpoints 750 and 990 px; page padding 15 px mobile, 50 px desktop; heading scale h1 30/40 px, h2 20/24 px, h3 17/18 px, h4 15 px (mobile/desktop); body line-height about 1.8 and letter-spacing 0.6 px; uppercase captions tracked 1.3 px; buttons at least 45 px tall, with a 2.5 px lift on hover only for hover-capable devices and only when motion is allowed; image zoom on card hover is scale 1.03 over the long duration, desktop only; focus ring 2 px outline with a 3 px offset plus a soft ring; menus open with a 15 px rise and fade; every keyframe animation is wrapped in `prefers-reduced-motion: no-preference`. Saleor's storefront keeps colours as OKLCH custom properties in one brand file so a palette swap is a few lines. Horizon (Shopify's newer theme) states a principle we adopt: progressive enhancement, server-rendered, lean.

### 1.3 Research used

| Topic | Finding | Source and confidence |
|---|---|---|
| Serif or sans for fashion | No rule. Sans is common for navigation and body; serifs are used mainly to signal heritage; hairline serifs render badly at small sizes on screens; pair a serif display with a plain face for body copy | [Monotype review](https://www.monotype.com/resources/expertise/fonts-and-luxury-brands-fashion) (a font vendor: medium) |
| Uppercase navigation | Hard to read in long text; for one- or two-word labels it is fine; add a little letter-spacing; no controlled study decides it | [W3C WAI thread](https://lists.w3.org/Archives/Public/w3c-wai-ig/2014OctDec/0143.html), [letter-spacing guide](https://www.kevinpowell.co/article/letter-spacing-dos-and-donts/) (practitioner: low-medium) |
| Gold in UI | Gold on white is about 1.4 to 2.3:1 and fails as text; works as a fill with dark text; keep a darker text-safe gold | WCAG arithmetic (we measured 2.28:1 for our gold on paper): high |
| Colour tokens | OKLCH gives even lightness steps; relative colour can derive text from a surface; WCAG 2.x is the audit reference, APCA a useful second opinion | [OKLCH notes](https://frontendchecklist.io/rules/css/color-oklch): medium |
| Response times | 0.1 s feels instant, 1 s keeps the flow of thought, 10 s is the limit of attention; beyond 1 s show that work is happening | [NN/g, 3 response-time limits](https://www.nngroup.com/videos/3-response-time-limits-interaction-design/): high |
| Motion tokens | Material 3 uses short (50 to 200 ms), medium (250 to 400 ms), long (450 ms and up) steps; "standard" easing `cubic-bezier(0.2, 0, 0, 1)`; exits shorter than entrances | [Material 3](https://m3.material.io/styles/motion/easing-and-duration) via a third-party summary: medium |
| Cross-page transitions | `@view-transition { navigation: auto }` works in Chrome and Edge 126+, Safari 18.2+; Firefox support is unclear; a shared image needs the same `view-transition-name` on both pages; harmless where unsupported | [Chrome for Developers](https://developer.chrome.com/blog/shared-element-transitions-for-spas/) and 2026 blogs: medium |
| Pakistani connections | Many shoppers are on congested 3G or 4G with mid-range Android phones, outside the big cities; lab scores on office networks flatter; images are most of the page weight | [developer write-up](https://dev.to/muhammadfarzan0/building-fast-websites-for-pakistans-real-network-conditions-not-just-a-lighthouse-score-1lah) and an A4AI brief (2021 data): medium-low |
| Colour in photography-led shops | Not studied; reference stores use white or off-white so product colours read true | observation only |

## 2. Analysis of today's design

Measured from the code (`packages/ui/src/tokens.css`, `theme-presets.js`) and screenshots of 2026-10-15.

| Aspect | Today | Verdict |
|---|---|---|
| Fonts | Playfair Display headings (serif, weight 600 to 700 in places) + Inter body | Distinctive among all-sans peers, which is good, but a heavy serif at small sizes is the case the research warns about; keep it to display sizes |
| Type scale | 11, 13, 14, 16, 20, 28, 36, 48 px; "hero only" tops at 48 px; fixed, not fluid | Too narrow at the top (peers and Dawn reach 40 to 72 px on desktop), too small at the bottom (11 px is below a comfortable minimum), no fluid scaling |
| Body | 16 px, line height 1.5 | Fine; 1.6 reads better in descriptions |
| Colour | Paper `#FBF8F3`, ink `#141210`, gold `#C9A227`, text gold `#806010`, sale `#B23A2E`, line `#E7E0D4` | **Accessible** (every text pair passes; see §4.2); warm and different from the white peers; gold is used as the main call to action, which makes every page loud |
| Shape | Soft radius (8 px class), cards with borders | Softer than the 0 to 3 px peers; reads friendly, less premium |
| Depth | Borders and a few shadows | Calm; fine |
| Motion | Short fades, drawers; no hover choreography; no page transitions | Adequate, not special |
| Imagery | Generated placeholders in 3:4 | The biggest weakness, not a token problem |
| Hierarchy | Everything is similar in weight; section titles 24 px | Pages lack a clear first, second and third read |

## 3. Principles

1. **Quiet chrome, loud photographs.** Colour is for product, sale and one accent; everything else is ink, paper and white.
2. **One accent, used rarely.** The primary action is ink on paper; gold marks selection, rules and small highlights; red means sale or error only.
3. **Hierarchy through size and space, not weight and colour.** Three reads per screen: the picture, the name and price, the action.
4. **Real minimum sizes.** Nothing under 12 px; body 16 px on phones (also stops iOS zooming into inputs).
5. **Motion explains, never decorates.** Only transform and opacity; 100 to 300 ms; off when the visitor asks.
6. **Tokens first.** Every value below is a token in `packages/ui/src/tokens.css` and the theme; no hard-coded value in a component (a colour class that is not a token does nothing: `packages/CLAUDE.md`).

## 4. Specification

### 4.1 Typography

**Families (decision D1 in §8).** Recommended **A, Editorial**: **Playfair Display** (500) for the wordmark, the hero headline and page and section titles of 24 px and above; **Inter** (400, 500, 600) for everything else. Alternative **B, Modern sans**: one family (Jost or a similar geometric sans) like the leading Pakistani brands. Both are variable, self-hosted, Latin subset only (Urdu fonts load only when Urdu is on, which it is not). Staff can still pick presets in Appearance; the contrast gate and the type scale apply to all.

**Scale** (fluid between a 360 px and a 1280 px screen with `clamp()`, rounded to whole pixels):

| Token | Phone | Desktop | Line height | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| `display` | 40 | 64 | 1.05 | 500 serif | -0.01em | Hero headline only |
| `h1` | 30 | 44 | 1.12 | 500 serif | 0 | Page title (category, product name on landing pages) |
| `h2` | 24 | 32 | 1.2 | 500 serif | 0 | Section titles |
| `h3` | 20 | 24 | 1.25 | 500 sans | 0 | Card group titles, drawer titles |
| `h4` | 17 | 18 | 1.3 | 600 sans | 0 | Sub-headings, accordion titles |
| `body` | 16 | 16 | 1.6 | 400 | 0 | Descriptions, policy text (max 70 characters wide) |
| `ui` | 15 | 15 | 1.4 | 500 | 0 | Product name, buttons in sentence case, form values |
| `small` | 14 | 14 | 1.45 | 400 | 0 | Secondary text, helper text |
| `caption` | 12 | 12 | 1.4 | 400 | 0.02em | Fabric line, badges, legal; never below 12 |
| `label` | 12 | 13 | 1.2 | 500 | 0.08em, uppercase | Navigation, button labels, filter titles; three words at most |

Rules: the product name is **never** uppercase and never serif; prices use tabular numerals, weight 500, and the sale price in the sale colour with the old price struck through in muted; headings use `text-wrap: balance`; lines are 45 to 75 characters; links in text are underlined; numbers in the interface use `font-variant-numeric: tabular-nums`; no italics for emphasis in UI.

**Loading.** At most two font files in the first load (Inter variable, Playfair 500 subset) preloaded, `font-display: swap`, and a metric-matched fallback (`size-adjust`, `ascent-override`) so the swap does not move the layout. Budget: 70 kB of fonts, gzip.

### 4.2 Colour

Tokens keep the names of the theme (DOC-04) so presets keep working. Values for the new default preset **Atelier** (hex stored, as the theme does; contrast measured with the WCAG formula on 2026-10-16):

| Role | Value | Used for | Contrast (text on it or it on) |
|---|---|---|---|
| `bg` paper | `#FBF8F3` | Page | Ink on paper 17.6:1 |
| `surface` | `#FFFFFF` | Cards, drawers, inputs | |
| `surface2` | `#F4EFE6` | Bands, tags, quiet panels | Muted on it 6.2:1 |
| `fg` ink | `#141210` | Text, primary button fill | White on ink 18.7:1 |
| `fgSoft` | `#3D3832` | Long text | 10.9:1 on paper |
| `muted` | `#5E574D` (was `#6A6359`) | Secondary text, captions | 6.7:1 on paper |
| `line` | `#E7E0D4` | Decorative dividers only | not for meaning |
| `lineStrong` | `#7C7368` (was `#8C8279`) | Input and chip borders | 4.7:1 on white (needs 3:1) |
| `accent` gold | `#C9A227` | Fills: selection, small highlights, rules, badges | Ink on gold 7.7:1; **gold as text on paper 2.3:1, forbidden** |
| `accentText` | `#7A5C0B` | The only gold allowed as text | 5.9:1 on paper |
| `accentSoft` | `#FBF6E8` | Highlight backgrounds | |
| `sale` | `#A8302A` | Sale prices, sale badge, Sale in the menu, errors | 6.7:1 on white |
| `success` | `#2F6B40` | Confirmations | 6.0:1 |
| `warning` | `#855B1A` | Low stock text | 5.7:1 |
| `focus` | `#2C3E8C` | Focus ring (2 px, 2 px offset, plus a paper ring) | 9.1:1 |
| `scrim` | black at 70% to 0% | Under hero text | white text ≥ 4.5:1 required, measured per slide in M8-08 |

Rules: **the primary button is ink with white text** (the standard in this market; gold remains a fill for selected states, badges and the occasional campaign button); one primary button per view; the page is paper and cards are white, so product pictures sit on white; semantic colours never carry meaning alone (an icon or word accompanies them); every preset, including staff-made ones, passes the contrast gate (exists); image placeholders use the picture's dominant colour; **no colour class that is not a token**. A *Gold* preset stays available for the owner who prefers the loud look.

### 4.3 Layout and spacing

- **Breakpoints** (min-width): 640, 768, 1024, 1280 px. Layouts are designed at 360, 768 and 1280.
- **Container:** 1280 px maximum, gutters 16 px (phone), 24 px (768), 40 px (1024 and up). Full-bleed heroes and bands inside it.
- **Grid:** 4 columns on phones, 8 on tablets, 12 on desktop; product grids 2 (phone, with a 1-column option), 3 (768), 4 (1024), 5 optional (1440 density switch).
- **Spacing scale (4 px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Between sections: 48 phone, 96 desktop. Inside a card block: 8 to 16. Between a heading and its content: 16 to 24.
- **Header:** 56 px on phones, 72 px on desktop, plus a 36 px announcement bar; hide-on-scroll-down frees the space; z-index scale: content 0, sticky bars 20, header 30, drawers 40, dialogs 50, toasts 60.
- **Touch targets** at least 44 by 44 px; spacing between adjacent targets at least 8 px.

### 4.4 Shape and depth

- **Radius (amended 2026-10-21, see section 12):** 2 px for buttons and inputs, 4 px for cards, 0 for pictures, twice the card (8 px) for dialogs, drawers and sheets (`rounded-sheet`), full round for chips, tags on a round theme and floating controls; full round only for the avatar-like category circles and the heart button. A `radius` setting in Appearance still offers 0, 2, 8.
- **Borders:** 1 px `lineStrong` on inputs and chips, `line` on cards only when a card sits on a same-colour background; otherwise no border.
- **Shadows:** none on the page; menus and drawers use `0 12px 32px rgba(20, 18, 16, 0.12)`; the mega menu has no shadow, only a 1 px top line. A control that floats over the page (the WhatsApp button) uses `shadow-float`, `0 4px 16px rgba(20, 18, 16, 0.14)`. No gradients except the hero scrim.

### 4.5 Imagery

| Use | Ratio | Source widths | Notes |
|---|---|---|---|
| Product card and gallery | 3:4 | 320, 480, 640, 960, 1280 (zoom 1600 to 2000) | AVIF or WebP, quality 75; first card images eager, the rest lazy at 200 px |
| Category circles | 1:1, 160 px | 160, 320 | the category picture or its best seller |
| Hero | 4:5 phone, 16:9 desktop | 800, 1280, 1920 | art direction per slide (staff set a focal point); scrim as §4.2 |
| Category and editorial banners | 3:2 | 800, 1280 | |
| Review photos | 1:1 thumbnail, 4:3 full | 160, 960 | |

Rules: dimensions on every image (no layout shift); placeholder is the dominant colour, never a grey box; alt text describes the picture ("Model in a green lawn kurta, back view"), empty alt when the picture is decorative or repeats adjacent text; the product page leads with a picture of the garment on a model; zoom image at least 1600 px on the long side; `Save-Data` and slow connections get one size smaller.

### 4.6 Iconography

Lucide, 24 px (20 in dense rows), stroke 1.5 px, round caps, `currentColor`, with a text label wherever the meaning is not obvious (the bag, heart and search icons carry accessible names; the menu shows a word on wide screens). Icons are never the only carrier of meaning for status.

## 5. Motion and UI behaviour

### 5.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 0 ms | state changes the user caused (selecting a chip) |
| `--dur-fast` | 100 ms | colour, underline, focus |
| `--dur-base` | 200 ms | hover, small panels, toasts, accordions |
| `--dur-slow` | 300 ms | drawers, sheets |
| `--dur-image` | 400 ms | a second picture fading in (amended 2026-10-21) |
| `--dur-reveal` | 600 ms | editorial blocks and headlines coming into view |
| `--dur-page` | 250 ms | page transition |
| exit rule | entrance minus 50 ms | closing is faster than opening |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | entering and moving |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | leaving |
| reduced motion | all durations 0, no autoplay, no parallax, no lift, no shimmer | `prefers-reduced-motion: reduce` (tested) |

Only `transform` and `opacity` animate (no layout properties).

### 5.2 Response time ladder (applies to every action)

| Wait | What the interface does |
|---|---|
| up to 100 ms | nothing special; the result appears |
| 100 ms to 1 s | immediate local feedback: pressed state, button label replaced by a spinner with the width kept, heart fills at once (optimistic) |
| 1 s to 10 s | a skeleton for content areas, or a progress state on the button with the words "Adding..."; the rest of the page stays usable |
| over 10 s | a message with Retry and a WhatsApp link; the action is not repeated silently |

### 5.3 Component behaviour (the rules the tests check)

| Component | Behaviour |
|---|---|
| **Header** | Hides when scrolling down more than 80 px, returns on any scroll up or when focus enters it; the announcement bar scrolls away; honours the "keep at the top" setting; no layout shift when it hides |
| **Mega menu** | Opens 150 ms after the pointer rests on an item (or at once on click, Enter, Space, Down arrow); closes 200 ms after the pointer leaves both the item and the panel (a grace period so moving diagonally works); one panel open at a time; panel enters with a 160 ms fade and an 8 px rise, leaves in 110 ms; Escape closes and returns focus to the item; focus leaving closes it |
| **Search overlay** | Opens in 200 ms; suggestions update 150 ms after the last key; the previous results stay until the new ones arrive (no flashing); Escape closes; a live status says "5 results" |
| **Product card** | Second picture crossfades in 300 ms on hover (fine pointers only); no zoom or lift on the card; the quick-add size bar slides up in 200 ms on hover or focus and is **always visible on touch**; the heart pops 1 to 1.15 to 1 in 200 ms; the whole card is one link; focus ring on the card |
| **Gallery** | Phone: swipe with scroll-snap, dots under the picture; desktop: thumbnails left, arrow keys change picture; hover shows a 2.5x lens (not an overlay panel); tap opens a full-screen viewer with pinch zoom and swipe to close; the first thumbnail row is signposted with a partly visible next one |
| **Size chips** | A radio group (arrows move, Space chooses); the chosen chip fills ink with white text; a sold-out size is struck through and says "sold out" to screen readers but can still be focused to read why; a low-stock size shows "2 left" |
| **Add to bag** | Pressed state at once; label becomes a spinner (width kept); on success the button shows a check and "Added" for 1.2 s, the bag count bumps, and the mini-bag opens in 300 ms; on failure the reason appears under the button and focus stays; double press is ignored; the button is never disabled without a stated reason |
| **Mini-bag drawer** | Right edge on wide screens, bottom sheet on phones (up to 85% high); in 300 ms, out 250 ms; focus moves in and returns to the trigger; page scroll locked; backdrop 40% black closes it; Escape closes; swipe down closes the sheet |
| **Quantity stepper** | Updates the line and totals optimistically within 100 ms and corrects if the server disagrees, with a toast; minimum 1; remove has an Undo toast for 5 s |
| **Filters** | Wide: apply on change, the grid fades to 60% for the request, and the count updates; phone: bottom sheet where choices are held until "Show N items", the count updating live 300 ms after each change; Clear all; the address always holds the state |
| **Carousel (hero)** | Scroll-snap; autoplay every 6 s, paused on hover, focus, touch and when the tab is hidden; off with reduced motion; arrows, dots and a pause button; the first slide image is preloaded |
| **Accordion** | `<details>`; height animates in 200 ms; one stays open by default (Details) |
| **Toast** | Bottom on phones, top right on wide; enters in 200 ms; stays 4 s (8 s with an action); paused on hover and focus; swipe or button dismisses; polite live region; at most 2 stacked |
| **Forms** | Validate on leaving a field the first time, then on every change for that field; error text appears under the field (space is not reserved, the content below moves down once); on submit the first invalid field is focused and the count announced; values are never lost |
| **Skeletons** | Page-coloured blocks the size of what they replace; a slow shimmer (1.4 s) only when motion is allowed |
| **Page transitions** | `@view-transition { navigation: auto }`: a 250 ms crossfade; from a card to a product page the card picture and the gallery picture share a `view-transition-name` built from the product id so the picture grows into place; unsupported browsers navigate normally |
| **Scroll** | Position restored on Back, including "Load more" results; "Back to top" after two screens; anchors respect the header offset |
| **Prefetch** | Links prefetch on hover or touch start (exists); product images for the next page are not prefetched |

### 5.4 Focus and keyboard

Focus ring: 2 px `focus` colour, 2 px offset, plus a 2 px paper ring for contrast on pictures; visible on every interactive element, never removed; the order follows the visual order; every drawer and dialog traps focus and returns it; skip link first; the keyboard map of each component above is in its test.

## 6. Microcopy and voice

- **Voice:** plain, warm, short; sentence case; no exclamation marks on system text; no "please" in instructions; say what happened and what to do.
- **Words, chosen once:** *bag* (decision D5 in §8; the shop says "cart" today; most Pakistani brands say bag), *wishlist*, *size guide*, *cash on delivery*, *delivery* not *shipping* in customer text, *order number*.
- **Examples:** Button: "Add to bag", "Select a size", "Notify me", "Place order". Stock: "Only 3 left", "Sold out in M". Delivery: "Arrives in 3 to 5 days to Lahore", "Free delivery over Rs 3,000: add Rs 1,200 more". Errors: "That mobile number doesn't look right. Try 0300 1234567." Empty bag: "Your bag is empty. Start with something new." No-results: "Nothing for "kurtas". Try a shorter word or browse Women." Order: "We will call or WhatsApp you on 0345 ••••301 to confirm."
- **Numbers and dates:** Rs 3,490 (no decimals), 3 to 5 days, 18 Oct (day month, no year within a year), 24-hour times avoided.
- **Urdu** is off; strings stay in the catalogs so it can be switched on later.

## 7. Performance guardrails for the design

Animations use compositor properties only; the mega menu panels are server-rendered HTML shown by CSS and JavaScript only adds the intent timing and keyboard; fonts at most 70 kB; no layout shift from fonts, images, announcement or sticky bars (CLS under 0.05); hero text, not hero image, is the LCP candidate on phones where possible; the design never adds a third-party script. The ceilings of DOC-06.11 §7 apply.

## 8. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Typography: **A Editorial** (serif display + Inter) or **B Modern sans** (one family like the leading brands) | **A**, with the serif only at 24 px and above; B stays as a preset |
| D2 | Primary button: **ink** (recommended) or **gold** | Ink; gold becomes the accent |
| D3 | Corners: 2 px (recommended), 0 px, or the current soft 8 px | 2 px |
| D4 | Page colour: **paper** `#FBF8F3` (recommended) or pure white like the peers | Paper |
| D5 | "Add to **bag**" or "Add to **cart**" | Bag |
| D6 | Header: solid (recommended) or see-through over the home banner (optional setting) | Solid, option off |

## 9. How the design is judged

1. **Token tests:** a unit test reads `tokens.css` and the presets and fails on a text size under 12 px, a missing token, a hard-coded colour in the storefront, or a preset that fails the contrast gate (extends the existing gate with the pairs of §4.2).
2. **Typography proof:** an end-to-end test loads ten pages and asserts the computed font family, size, weight and line height of the h1, h2, product name, price, label and body against §4.1 at 390 and 1280 px; and that no element is smaller than 12 px.
3. **Motion tests:** durations come from tokens (grep test); with reduced motion on, no `animation` or `transition` longer than 0 ms is computed on the components of §5.3 (a Playwright pass); the menu's intent timings are asserted with a fake clock.
4. **Visual baselines** (DOC-06.11 §8.2) at 390, 768 and 1280 px, including the open menu, the card hover, the quick-add bar, the drawer and the toast.
5. **A specimen page** (`/design`, staff only, off in production) listing every token, type style, button state, form state and component state, used for review and for the baselines.
6. **Five-second test** with five people on the home page and a product page: "what is sold here, and where would you click first?" Pass: at least 4 of 5 answer both correctly.
7. **Preference test** between the two typography options on three screens, with the owner and five shoppers, before D1 is final.
8. The scorecard rows VD-01 to VD-10 of DOC-06.14 are scored from these.

## 10. Tasks

| Task | Change |
|---|---|
| **M8-02 (extended)** | Design tokens v2: the type scale and fonts, the Atelier preset, radius, spacing, motion tokens, z-index scale, `Save-Data` image sizes; the token tests |
| M8-03 to M8-08 | Each component built to §5.3 and tested against it |
| **M8-09 (reduced)** | Page transitions, skeleton polish, the specimen page, the optional header and bottom bar |
| M8-10 | The preference test, the five-second test, closure |

## 11. Changelog

| Date | Change |
|---|---|
| 2026-10-16 | Created from measured typography of five Pakistani brands, the code of Shopify Dawn and Saleor, and the research of §1.3; contrast values measured with the WCAG formula |
| 2026-10-21 | Foundation pass (section 12): hover and press states that show on ink, tags, eyebrow, 4 px cards and 8 px sheets, float shadow, image and reveal durations, gutter/block/section space, aspect tokens, heading weight 500 |

## 12. Foundation pass, 2026-10-21 (what changed in the tokens and the shared components, and what was left for the pages)

| Area | Before | Now | Where |
|---|---|---|---|
| Primary button hover | `brightness-95`: invisible on near-black | `bg-accent-hover` (the accent 12% toward its text colour: ink lifts, a light accent deepens, any theme); press settles 1 px and returns to the base colour | `tokens.css` `--color-accent-hover`, `button.jsx` |
| Secondary, ghost, text button | fill change only | secondary darkens its edge to ink; ghost gains a pressed fill; the text button's underline firms up from 40% to full | `button.jsx` |
| Inputs, select, checkbox, radio | static border | the border goes to ink on hover (not while invalid or disabled), colour changes ease in `--dur-micro` | `control-styles.js`, `checkbox.jsx`, `radio-group.jsx` |
| Merchandising mark | a hand-built span on the card | `Tag` (tones `ink` New, `sale`, `paper` Bestseller / Limited / Made to order, `quiet` Sold out): 12 px capitals, tracking 0.05em, one per product | `badge.jsx`, `product-card.jsx` `badgeTone` |
| Eyebrow | none | `eyebrow`: the label size (12 to 13 px, 0.08em), capitals, soft ink; three words at most | `app.css` |
| Heading weight | 400 by default | `display`, `h1`, `h2` carry weight 500 (section 4.1) | `app.css` |
| Radius | control 2, card 2, media 0 | control 2, card 4, media 0, sheet = card x 2 (`rounded-sheet`: dialog, drawer, bottom sheet) | `tokens.css`, `theme.js`, `dialog.jsx` |
| Shadow | `shadow-lg` on the WhatsApp button compiled to nothing (the default scale is cleared) | `shadow-float` | `tokens.css`, `shell.jsx` |
| Motion | micro 120 ms | micro 150 ms, `--dur-image` 400 ms, `--dur-reveal` 600 ms, overlays ease with `ease-out`; all zero under reduced motion | `tokens.css`, `dialog.jsx`, `product-card.jsx` |
| Reveal | none | `reveal`: rises 16 px and fades over the first 40% of its entry; CSS scroll-driven, only where supported and motion is allowed | `app.css` |
| Space | `px-4` and `py-*` written per page | `px-gutter` (16 / 24 / 40 px at 768 and 1024), `py-block` (32 to 64), `py-section` (48 to 96) | `app.css` |
| Picture ratios | per page | `aspect-portrait` 3:4, `aspect-editorial` 4:5, `aspect-landscape` 3:2, `aspect-cinema` 16:9; the product ratio stays the theme's `--media-ratio` | `app.css` |

Two things to know. (1) `cn` (tailwind-merge) has its own list of token names in `packages/ui/src/cn.js`: a new colour, radius, shadow or type-size token must be added there or a class next to a colour class is silently dropped (found when `text-caption text-surface` lost its size). (2) The Atelier preset is the default of a new shop, but a shop that saved an older theme keeps it (this machine's dev database still holds the gold preset, so its primary button is gold): choose Atelier in Appearance to see the design as specified.

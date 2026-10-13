# 06.10 — Storefront: Performance

| Field | Value |
|---|---|
| 2026-10-14 | M7-09: JavaScript of the pages cut by 15 to 20% (zod out of the pages, a small ICU formatter, five panels loaded on first use); ceilings lowered (§2 "M7-09"). The visitor address now reaches the API (DOC-11 §9, `apps/e2e/tests/20-visitor-limits.spec.js`) |
| ID | DOC-06.10 |
| Title | Budgets and the techniques that meet them on mid-range Android over mobile data |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1 … 06.9, DOC-04a §7 |
| Decisions used | ADR-0004, ADR-0006, ADR-0009, ADR-0011, ADR-0018, ADR-0019 |

## 1. Purpose and scope

**Governs:** the storefront's performance budgets and the implementation rules for images, fonts, JavaScript, CSS, caching and third-party scripts.
**Does not govern:** how budgets are enforced in CI and monitored in production (DOC-13), CDN and host configuration (DOC-14), API response times (DOC-08).

Context: published 2026 figures put smartphones at over 80% of e-commerce orders in Pakistan (DOC-02 §4, secondary sources). The reference device and network for every number below is a **mid-range Android phone (4× CPU slowdown in Lighthouse) on "Slow 4G" (1.6 Mbps down, 150 ms RTT)**.

## 2. Budgets

"Good" Core Web Vitals thresholds are LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, measured at the 75th percentile of real visits.

| Metric | Home | PLP | PDP | Cart / checkout |
|---|---|---|---|---|
| LCP (lab, reference profile) | ≤ 2.5 s | ≤ 2.5 s | ≤ 2.5 s | ≤ 3.0 s |
| INP (field p75) | ≤ 200 ms | ≤ 200 ms | ≤ 200 ms | ≤ 200 ms |
| CLS | ≤ 0.05 | ≤ 0.05 | ≤ 0.05 | ≤ 0.1 |
| TTFB at the origin (p75, CDN miss) | ≤ 600 ms | ≤ 600 ms | ≤ 600 ms | ≤ 800 ms |
| JavaScript, gzip, total for the route | ≤ 150 kB | ≤ 170 kB | ≤ 170 kB | ≤ 190 kB |
| CSS, gzip | ≤ 25 kB (one file, all routes) | | | |
| HTML document, gzip | ≤ 40 kB | ≤ 60 kB | ≤ 50 kB | ≤ 30 kB |
| Fonts on first load | ≤ 80 kB (English); Urdu adds ≤ 150 kB (ADR-0018) | | | |
| Image bytes above the fold | ≤ 120 kB | ≤ 160 kB (4 cards) | ≤ 120 kB | — |
| Requests before LCP | ≤ 12 | ≤ 14 | ≤ 12 | ≤ 12 |
| Third-party JavaScript | 0 kB before interaction (§7) | | | |

The JS budgets match ADR-0004 (≤ 170 kB on PLP/PDP). A PR that exceeds a budget must either fix it or change this table with a reason.

**Measured at M5-11 (first real build, 2026-10-12; Q-06.10-4).** The targets above were estimates and the build does not meet the JavaScript ones. The gates (`pnpm --filter @noor/storefront budget` and `... lighthouse`) therefore hold the first build's numbers as **ceilings that may only come down**, and the targets stay the goal:

| Page | JS gzip measured | Ceiling now | Target | LCP lab (median of 3) | LCP ceiling now | Target |
|---|---|---|---|---|---|---|
| Home | 283.2 kB (233.4 at M7-09) | 240 | 150 | 4.13 s | 4.5 s | 2.5 s |
| PLP | 287.8 kB (239.7) | 248 | 170 | 4.17 s | 4.5 s | 2.5 s |
| PDP | 302.7 kB (261.3) | 268 | 170 | 4.10 s | 4.5 s | 2.5 s |
| Cart | 279.2 kB (243.5) | 250 | 190 | 3.63 s | 4.0 s | 3.0 s |
| Checkout | 293.0 kB (244.8) | 252 | 190 | not run | not run | 3.0 s |

Other numbers met: CSS 9.2 kB (≤ 25), HTML 8 to 19 kB (≤ 30 to 60), CLS 0.000 (≤ 0.05), server response 42 to 326 ms (≤ 600), third-party requests 0. Over: fonts 86 kB for English (≤ 80; Playfair Display 38 kB + Inter 48 kB, variable, Latin) and 259 kB for Urdu (≤ 150; the Nastaliq file alone is 239 kB, no smaller subset exists); the Urdu figure stands until a lighter Urdu face is chosen (ADR-0018).

**Why the JavaScript is twice the estimate.** React 19 with React Router 8 is about 105 kB gzip before any page code; i18next with the ICU plugin and both catalogs is about 65 kB; the Base UI parts behind the header, drawers and dialogs are about 45 kB. The lab is Lighthouse's simulated Slow 4G over HTTP/1.1 against the Node server (35 script requests queue on 6 connections; a CDN with HTTP/2 and Brotli, DOC-14, will do better), so its LCP is a ceiling for trend, not a forecast. **Ways down, in order of size:** load the cart drawer, mobile menu, filter drawer, size-guide drawer and gallery zoom only when first opened (about 35 kB); drop the ICU plugin for i18next's own plurals (about 15 kB, an ADR-0018 change); Brotli (about 15 %).

**M7-09: what was cut, and why the targets stay out of reach.** The same build was taken apart by the source map (bytes of each package in the code a home page loads, before gzip): React DOM 207 kB, React Router 128, Base UI 100, i18next 43 with its messages 38, tailwind-merge 28, the shop's own code about 100. Four changes took the pages from 279–303 kB to 233–261 kB gzip (the lab LCP was not measured again; it is dominated by the simulated slow network): (1) **zod left the pages** — `Money` and the `Enum` schemas moved out of `money.js` and `enums.js` into `money-schema.js` and `enum-schemas.js`, because a module with a top-level zod call is kept whole as soon as one of its exports is used, and the browser used only the plain helpers (about 20 kB gzip); (2) **the ICU plug-in of i18next** (`intl-messageformat`) was replaced by `packages/i18n/src/icu-lite.js`, 80 lines that do what the shop's texts use (variables, plural, select, the apostrophe rules), checked against the real formatter on every message of every catalog (about 10 kB); (3) **the cart panel, the phone menu, the picture zoom, the size guide and the filters sheet are separate files**, downloaded the first time the button is pressed (about 20 kB on the pages that carry them); the buttons are in the page, so nothing changes for a visitor with a fast connection and one without JavaScript is not affected (they never had the panels). What remains is mostly React DOM and React Router (about 105 kB gzip together, the floor of this stack), the i18n catalogs and i18next (about 25), Base UI's button, field and toast (about 30) and the shop's own code. **The targets (150 to 190 kB) are not reachable with this stack without dropping React Router's client runtime or Base UI**; they stay as the goal, the ceilings come down to the figures above plus a margin of a few kilobytes, and a change that raises a page over its ceiling must say why. Not done and worth doing if the numbers matter: Toast and the number field loaded on demand (about 10 kB), `tailwind-merge` replaced by a build-time merge (about 9 kB).

## 3. Images (the largest cost)

| Rule | Detail |
|---|---|
| Delivery | Always through the signed transform URL built by the API (ADR-0011, DOC-08 §11) via the `Image` component; never the original upload |
| Formats | AVIF, then WebP, JPEG fallback, chosen by the transform layer from the `Accept` header (one URL, `Vary: Accept` at the image host) |
| Widths | Fixed ladder `[320, 480, 640, 828, 1080, 1600]` (the allow-list of ADR-0011; only these widths are ever signed, DOC-08 §11); `srcset` lists the ones up to 2× the largest rendered size; no arbitrary widths (keeps the CDN cache small) |
| Quality | AVIF 50, WebP 70, JPEG 75 (transform defaults); hero may use +10 |
| `sizes` | Card: `(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw`. PDP main: `(min-width:1024px) 50vw, 100vw`. Hero: `100vw` |
| Dimensions | `width` and `height` always set from the media record; the wrapper uses `aspect-(--media-ratio)`; this is what keeps CLS near 0 |
| Priority | Exactly the LCP image per page gets `priority` (`loading="eager"`, `fetchpriority="high"`; React adds the `<link rel="preload" as="image">` for it by itself, so there is no `links` entry). PLP: the first 4 cards eager without `fetchpriority` (`priority="eager"` of the `Image` component). Everything else `loading="lazy" decoding="async"` |
| Placeholder | `lqip` (≤ 1 kB blurred data URI from the media record) as the wrapper background; no JS fade-in logic |
| Caching | Image responses `Cache-Control: public, max-age=31536000, immutable` (URL contains the content key) |
| Video | `preload="none"`, poster image, never auto-loaded |

## 4. Fonts

| Rule | Detail |
|---|---|
| Hosting | Self-hosted woff2 only (DOC-04a §7); `font-display: swap`. The `@font-face` rules of the two families the theme names (and the Urdu face on `/ur`) are written by `lib/fonts.server.js` into the same inline block as the theme, so the CSP hash covers them; the files are Vite assets (`/assets/`, hashed, immutable) |
| Preload | Only the two files needed for above-the-fold text: body regular and heading 600 (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) |
| Subsets | `latin` only on English pages; the Urdu font is requested only on `/ur` pages |
| Fallback metrics | `size-adjust`, `ascent-override` on the fallback `@font-face` so the swap does not shift layout. Built for Inter only (`"Inter Fallback"`, Arial sized like it, figures from the font's published metrics); Playfair Display and Instrument Sans have none because their metrics were not measured here. Measured CLS is 0.000 without them |
| Weights | Variable fonts: one file per family covers all weights |

## 5. JavaScript

| Rule | Detail |
|---|---|
| Server first | Content pages render fully on the server (ADR-0004); JS only adds interaction |
| Route splitting | Automatic per route module. Checkout form code, the gallery zoom dialog, the size-guide drawer, the review form and the filter drawer are loaded with `React.lazy` on first use |
| Dependencies allowed in the storefront client bundle | `react`, `react-dom`, `react-router`, `@noor/ui` components actually used, `@noor/contract` (schemas used by forms only), `react-hook-form` + resolver (checkout and review routes only), `zustand`, `i18next`/`react-i18next`, `clsx`, `tailwind-merge`. Anything else needs a DOC-03 changelog entry |
| Not in the client bundle | `react-markdown` (server-rendered pages only, in `.server.ts`), full locale catalogs (only the route's namespaces are sent), `lucide-react` as a whole (import icons by name) |
| Hydration | No work at module scope; no `useEffect` chains on mount; lists keyed by id |
| Long tasks | No single task over 50 ms after hydration on the reference profile. Expensive handlers (filter form with many facets) update through a transition (DOC-05 §8) |
| Prefetch | `<Link prefetch="intent">` on product cards and main navigation (prefetch on touchstart/hover). `prefetch="viewport"` is not used (wastes mobile data) |
| React Compiler | On (DOC-05 §4) |

## 6. Caching and data

| Layer | Rule |
|---|---|
| CDN | L pages `s-maxage=60, stale-while-revalidate=600`; S pages `s-maxage=3600, swr=86400`; purge by tag on publish (DOC-08). A cached page costs about 0 ms of origin time |
| Cache key | Path + canonical query + `Accept-Language` bucket; cookies are **not** in the key, which is why L and S pages contain no customer data (DOC-06.1 §3) |
| Storefront server | 30 s in-process cache for store config, site settings, menus and the category tree |
| Loaders | Independent calls run in parallel (`Promise.all`); below-the-fold data is deferred (DOC-05 §7); one listing call returns items and facets together |
| Compression | Brotli for HTML, CSS, JS, JSON, SVG at the CDN |
| HTTP | HTTP/2 or HTTP/3 at the CDN; `103 Early Hints` for the CSS and the two fonts if the CDN supports it |
| Static assets | Hashed filenames, `max-age=31536000, immutable` |
| Static assets origin | Same host as the pages (no extra connection); only images use `img.<domain>` with a `<link rel="preconnect">` |

## 7. Third-party scripts

| Rule | Detail |
|---|---|
| Default | None. The floating WhatsApp control is a plain link, not a widget script |
| Analytics / pixels | Defined in DOC-12; loaded only after the `load` event **and** consent where required, with `async`, from a single loader module; never in `<head>` blocking |
| Budget | Each third-party script must state its transfer size and main-thread time in the PR; total third-party main-thread time ≤ 250 ms on the reference profile |
| Maps, chat widgets, review widgets, font services | Not allowed; the contact page links out to the map |
| Payment provider scripts | Only on the provider's hosted page (ADR-0017), never on ours |

## 8. Perceived speed

- Skeletons match final sizes (DOC-04c §6); no spinner pages.
- Optimistic cart quantity and wishlist (DOC-05 §9).
- Client navigations show a 2 px progress bar after 150 ms.
- "Add to cart" responds within 100 ms visually (button `loading`), drawer opens when the response arrives.
- `content-visibility: auto` with `contain-intrinsic-size` on below-the-fold home sections and the reviews block.

## 9. How it is measured (summary; DOC-13 owns the gates)

| What | Tool | When |
|---|---|---|
| Lab budgets in §2 | Lighthouse CI with the reference profile against a seeded build, on Home, one PLP, one PDP, cart | Every PR touching `apps/storefront` or `packages/ui` |
| Bundle sizes | Build output compared with the budget table by a script | Every PR |
| Field Core Web Vitals | `web-vitals` library (about 2 kB) reporting LCP/INP/CLS with route name to the analytics endpoint | Production |
| Real devices | Manual pass on one mid-range Android on a throttled connection | Before each release that changes layout |

## 10. Rules

**Always:** size every image; give exactly one image per page `priority`; check the bundle report when adding an import to a storefront client file; keep customer data out of cached responses.
**Never:** add a third-party script to `<head>`; import a library into the storefront client for one helper; lazy-load the LCP image; fetch data in the browser that the loader could have sent; animate layout properties (use `transform`/`opacity`).
**Common mistakes:** `priority` on several images; a `sizes` attribute left at `100vw` on grid cards (downloads images 2–4× too large); importing `@noor/contract` whole into a client file (pulls every schema).

## 11. Acceptance checklist

- [ ] Lighthouse CI on the reference profile meets every lab number in §2 for the four routes. *Not met: CLS, server response, third-party requests and document size are; LCP and JavaScript are held at the ceilings of §2 (measured), not at the targets. The runs are local (`pnpm --filter @noor/storefront lighthouse`); there is no CI yet (needs a push).*
- [ ] The built client bundle for PLP and PDP is ≤ 170 kB gzip; the report is attached to the PR. *Not met: 239.7 and 261.3 kB after M7-09 (ceilings 248 and 268, §2; were 287.8 and 302.7); `pnpm --filter @noor/storefront budget` prints the report and fails above a ceiling.*
- [ ] Network panel on a PDP: one eager image, the rest lazy; AVIF served to Chrome; no request to a third-party host before interaction. *One `fetchpriority=high` image and no third-party request (Lighthouse). AVIF is not served: the local image layer makes WebP and JPEG only (`IMAGE_TRANSFORM=none`, M0-08 skipped).*
- [x] CLS is ≤ 0.05 while fonts swap and deferred sections arrive. *0.000 on Home, PLP, PDP and Cart (Lighthouse, median of 3).*
- [ ] `curl -I` on an L page shows the CDN cache header as a hit on the second request and no `Set-Cookie`. *No `Set-Cookie` and the L class header are tested (`shell.server.test.js`); a CDN hit needs a CDN.*
- [ ] No long task over 50 ms in a Performance recording of: open filter drawer, change quantity, open cart drawer. *Not recorded.*

## 12. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.10-1 | CDN features (tag purge, Early Hints, `Accept`-aware image caching) | Available on the chosen provider | DOC-14 provider choice |
| Q-06.10-2 | Hosting region latency to Pakistan | TTFB budget assumes ≤ 150 ms RTT; ADR-0019 requires measuring it | Measurement from Karachi/Lahore |
| Q-06.10-3 | Core Web Vitals thresholds | Taken from 2026 secondary sources citing Google's definitions | Google changes them |
| Q-06.10-4 | Bundle budgets | **Measured at M5-11** (§2): about twice the estimate; held as ceilings that only come down | The reductions of §2 are built |

## 13. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 4: width ladder aligned with ADR-0011; URLs are built and signed by the API |
| 2026-10-02 | Phase 5: field metrics go to our own `POST /api/v1/vitals` (DOC-12 §6.1); third-party analytics rules in DOC-12 §6.2 |
| 2026-10-12 | M5-11: first measured build (§2 "Measured at M5-11"), budgets held as ceilings. Built: `scripts/bundle-budget.mjs` and `scripts/lighthouse.mjs` (`pnpm --filter @noor/storefront budget` and `lighthouse`; `lighthouse` is a dev dependency, Chrome or Edge must be installed), self-hosted variable fonts with preload, `web-vitals` (own chunk, loaded after `load`, sent with `sendBeacon` to the storefront's `POST /vitals`, which passes it to the API; not in development), Markdown rendered on the server (`lib/markdown.server.jsx`, PDP −47 kB), `prefetch="intent"` on product cards and menu links, `content-visibility` on below-the-fold sections, a 2 px navigation bar with a CSS delay of 150 ms, `preconnect` to the image host when it is another origin, `Image priority="eager"`. Not built: lazy drawers and dialogs, `React.lazy` forms, Early Hints, optimistic quantity (the cart round trip shows the button's own loading state). The API's rate limit counts the storefront server as one visitor (no `X-Internal-Key` or visitor address is forwarded yet): see DOC-16 M7. |

# 06.10 — Storefront: Performance

| Field | Value |
|---|---|
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

## 3. Images (the largest cost)

| Rule | Detail |
|---|---|
| Delivery | Always through the signed transform URL built by the API (ADR-0011, DOC-08 §11) via the `Image` component; never the original upload |
| Formats | AVIF, then WebP, JPEG fallback, chosen by the transform layer from the `Accept` header (one URL, `Vary: Accept` at the image host) |
| Widths | Fixed ladder `[320, 480, 640, 828, 1080, 1600]` (the allow-list of ADR-0011; only these widths are ever signed, DOC-08 §11); `srcset` lists the ones up to 2× the largest rendered size; no arbitrary widths (keeps the CDN cache small) |
| Quality | AVIF 50, WebP 70, JPEG 75 (transform defaults); hero may use +10 |
| `sizes` | Card: `(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw`. PDP main: `(min-width:1024px) 50vw, 100vw`. Hero: `100vw` |
| Dimensions | `width` and `height` always set from the media record; the wrapper uses `aspect-(--media-ratio)`; this is what keeps CLS near 0 |
| Priority | Exactly the LCP image per page gets `priority` (`loading="eager"`, `fetchpriority="high"`, and a `<link rel="preload" as="image" imagesrcset imagesizes>` from the route's `links`). PLP: the first 4 cards eager without `fetchpriority`. Everything else `loading="lazy" decoding="async"` |
| Placeholder | `lqip` (≤ 1 kB blurred data URI from the media record) as the wrapper background; no JS fade-in logic |
| Caching | Image responses `Cache-Control: public, max-age=31536000, immutable` (URL contains the content key) |
| Video | `preload="none"`, poster image, never auto-loaded |

## 4. Fonts

| Rule | Detail |
|---|---|
| Hosting | Self-hosted woff2 only (DOC-04a §7); `font-display: swap` |
| Preload | Only the two files needed for above-the-fold text: body regular and heading 600 (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) |
| Subsets | `latin` only on English pages; the Urdu font is requested only on `/ur` pages |
| Fallback metrics | `size-adjust`, `ascent-override` on the fallback `@font-face` so the swap does not shift layout |
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

- [ ] Lighthouse CI on the reference profile meets every lab number in §2 for the four routes.
- [ ] The built client bundle for PLP and PDP is ≤ 170 kB gzip; the report is attached to the PR.
- [ ] Network panel on a PDP: one eager image, the rest lazy; AVIF served to Chrome; no request to a third-party host before interaction.
- [ ] CLS is ≤ 0.05 while fonts swap and deferred sections arrive.
- [ ] `curl -I` on an L page shows the CDN cache header as a hit on the second request and no `Set-Cookie`.
- [ ] No long task over 50 ms in a Performance recording of: open filter drawer, change quantity, open cart drawer.

## 12. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.10-1 | CDN features (tag purge, Early Hints, `Accept`-aware image caching) | Available on the chosen provider | DOC-14 provider choice |
| Q-06.10-2 | Hosting region latency to Pakistan | TTFB budget assumes ≤ 150 ms RTT; ADR-0019 requires measuring it | Measurement from Karachi/Lahore |
| Q-06.10-3 | Core Web Vitals thresholds | Taken from 2026 secondary sources citing Google's definitions | Google changes them |
| Q-06.10-4 | Bundle budgets | Estimated, not measured (no storefront build exists yet) | First real build at M1: adjust the table once, with numbers |

## 13. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 4: width ladder aligned with ADR-0011; URLs are built and signed by the API |
| 2026-10-02 | Phase 5: field metrics go to our own `POST /api/v1/vitals` (DOC-12 §6.1); third-party analytics rules in DOC-12 §6.2 |

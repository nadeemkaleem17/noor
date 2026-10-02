# 06.2 — Storefront: Home

| Field | Value |
|---|---|
| ID | DOC-06.2 |
| Title | Home page sections, data and behaviour |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-04b, DOC-04c |
| Decisions used | ADR-0004, ADR-0011, ADR-0013, ADR-0014 |

## 1. Purpose and scope

**Governs:** the home page (`/`): its sections, their order, the data each needs and the rules for the hero.
**Does not govern:** the shell (DOC-06.1), the product card (DOC-06.3 §3), how staff edit this content (DOC-07 content).

## 2. Sections (fixed order in v1)

Content comes from `SiteSettings` (contract) and catalog queries. Every section is omitted when its data is empty or disabled; the page never shows an empty frame.

| # | Section | Source | Shown when |
|---|---|---|---|
| 1 | Hero carousel | `SiteSettings.heroSlides` sorted by `sortOrder` | ≥ 1 slide |
| 2 | Trust strip | Derived from `StoreConfig`: free-delivery threshold (lowest `freeAbove` across zones), "Cash on delivery" when COD is enabled, return window from `policies.returns` presence, WhatsApp support | always (items with no data are dropped) |
| 3 | Category tiles | Top-level categories with an image, max 8 | ≥ 2 categories |
| 4 | New arrivals | `catalog.listProducts?sort=newest&limit=8` | ≥ 4 products |
| 5 | Promo band | `SiteSettings.promo` | `promo.enabled` and a heading |
| 6 | Bestsellers | `catalog.listProducts?sort=bestselling&limit=8` | ≥ 4 products |
| 7 | Editorial band | `SiteSettings.editorial` (image + copy + link) | `editorial.enabled` and a heading |
| 8 | Collections row | Collections flagged `featured`, max 3 | ≥ 1 |

The admin `PageTemplate` model (sections and blocks, contract) is **not rendered in v1**: the home order above is fixed. Revisit trigger: the owner asks to reorder or add sections more than twice; then `PageTemplate(type: 'home')` drives the order and this table becomes the section registry.

```
360 px
┌──────────────────────────┐
│ ┌──────────────────────┐ │ 1 hero 4:5, heading over a gradient,
│ │  Festive Edit        │ │   one button, dots + pause
│ │  [Shop now]   ● ○ ○ ⏸│ │
│ └──────────────────────┘ │
│ 🚚 Free over 5,000 · COD │ 2 trust strip (scrolls sideways)
│ ┌────┐┌────┐┌────┐┌────┐ │ 3 category tiles (scroll-snap row)
│ │Lawn││Stit││Foot││Acc │ │
│ New arrivals     View all│ 4 grid 2×4
│ ┌────┐┌────┐             │
│ │card││card│ …           │
│ ┌──────────────────────┐ │ 5 promo band
│ Bestsellers      View all│ 6 grid 2×4
│ ┌──────────────────────┐ │ 7 editorial
│ ┌──────┐┌──────┐┌──────┐ │ 8 collections
└──────────────────────────┘
```

## 3. Hero rules

| Rule | Detail |
|---|---|
| Component | `Carousel` (DOC-04b). One slide → a static banner, no controls |
| Ratio | 4:5 under `md`, 16:7 from `md`; the same image is cropped with `object-cover`, focal point centre |
| First slide image | `priority` (eager, `fetchpriority="high"`, preloaded with `imagesrcset`); it is the LCP element. Other slides lazy |
| Text | `heading` is the page `<h1>` on the first slide and `<h2>` on others; `subheading` ≤ 90 characters; text sits on a gradient overlay that guarantees 4.5:1 for white text |
| Button | `buttonText` + `buttonLink` through `LinkButton` (validated); omitted if either is empty |
| Auto-play | 6 s per slide; paused on hover, focus, when the tab is hidden and under reduced motion; a visible pause/play button (WCAG 2.2.2) |
| Controls | Previous/next buttons from `md`; swipe on touch; dots are buttons with `aria-label="Slide 2 of 3"` |
| Image source | `imageUrl` passed through the image transform (ADR-0011) at the ADR-0011 widths 480/828/1080/1600 |

If there are no slides, section 3 moves to the top and the site title is rendered as a visually hidden `<h1>`.

## 4. Loader

```ts
// app/routes/home.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const [newArrivals, featured] = await Promise.all([
    listProducts({ sort: 'newest', limit: 8 }, request),
    listCollections({ featured: true, limit: 3 }, request),
  ])
  const bestsellers = listProducts({ sort: 'bestselling', limit: 8 }, request) // below the fold: deferred
  return data({ newArrivals, featured, bestsellers }, { headers: cache.listing })
}
```

Site settings, store config and categories come from the shell loader (`useRouteLoaderData('routes/_shell')`); the home loader does not fetch them again.

## 5. Rules

**Always:** make the first hero image the only `priority` image; keep exactly one `<h1>`; link every section header to its listing ("View all" → `/new`, `/c/…`).
**Never:** auto-play without a pause control; put text inside hero images (untranslatable, unreadable when cropped); show a section with fewer items than its minimum.
**Common mistakes:** lazy-loading the LCP image; awaiting the bestseller query and delaying first byte.

## 6. Acceptance checklist

- [ ] With all `SiteSettings` home fields empty and two products, the page renders header, category tiles (if ≥ 2) and footer with no empty frames and one `<h1>`.
- [ ] LCP element on a 360 px viewport is the first hero image and it is in the server HTML with `fetchpriority="high"`.
- [ ] The carousel pauses under `prefers-reduced-motion` and has a working pause button.
- [ ] A hero `buttonLink` of `javascript:alert(1)` renders no button.
- [ ] Response has `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` and no `Set-Cookie`.

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.2-1 | `bestselling` sort exists in the catalog API | Yes (ADR-0010 lists it); backed by a nightly sales count | DOC-10 catalog |
| Q-06.2-2 | Category image and collection `featured` flag | Added to the contract in DOC-09 catalog | DOC-09 |
| Q-06.2-3 | `PageTemplate`-driven home | Deferred (§2) | Trigger in §2 |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 4: hero widths aligned with ADR-0011 |

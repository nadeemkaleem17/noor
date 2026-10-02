# 06.9 — Storefront: SEO

| Field | Value |
|---|---|
| ID | DOC-06.9 |
| Title | Titles, meta, canonical, indexing rules, structured data, sitemaps, social previews |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1 … 06.8 |
| Decisions used | ADR-0004, ADR-0013, ADR-0014, ADR-0018 |

## 1. Purpose and scope

**Governs:** what every page tells search engines and link-preview bots: `<title>`, meta description, canonical, robots, `hreflang`, Open Graph, JSON-LD, sitemaps and `robots.txt`.
**Does not govern:** page speed (DOC-06.10), analytics and merchant feeds (DOC-12), redirects (DOC-06.1 §4).

Fixes K7: today the title is `ecommerce-website`, there is no description, canonical, OG or JSON-LD, and products are rendered only in the browser.

All tags are produced by each route's `meta` export from loader data through one helper, `features/seo/meta.ts` (`buildMeta({ title, description, path, image, robots, type })`), so the rules below are implemented once.

## 2. Titles and descriptions

`<brand>` = `StoreConfig.brand.name`. Titles ≤ 60 characters (truncate the variable part, never the brand); descriptions 120–160 characters, plain text, no line breaks.

| Page | `<title>` | Meta description |
|---|---|---|
| Home | `<brand>: <brand.tagline>` (or `<SiteSettings.siteTitle>`) | `SiteSettings` SEO description if set, else `brand.tagline` + "Shop stitched, unstitched and made-to-order online. Delivery across Pakistan, cash on delivery." |
| Category | `category.seo.title` or `<Category> for Women │ <brand>` (pattern: `<title> │ <brand>`) | `category.seo.description` or the first 155 characters of the category description |
| Collection | `<Collection> Collection │ <brand>` | Collection description |
| `/new`, `/sale` | `New Arrivals │ <brand>`, `Sale │ <brand>` | Fixed message keys |
| Product | `product.seo.title` or `<title> – <colourway label> │ <brand>` | `product.seo.description` or `<subtitle>. ` + first 120 characters of the plain-text description + price (`Rs. 6,990`) |
| CMS page | `page.seo.title` or `<page title> │ <brand>` | `page.seo.description` or first 155 characters of the body text |
| Search, cart, checkout, order, track, wishlist | `<Page name> │ <brand>` | none |
| 404 | `Page not found │ <brand>` | none |

## 3. Canonical, robots, hreflang

| Rule | Detail |
|---|---|
| Canonical | Every indexable page has `<link rel="canonical">` = `PUBLIC_SITE_URL` + path, lower-case, no trailing slash, no tracking params |
| Product | Canonical is always `/p/:handle` (never with `?size=`) |
| Robots | `noindex, follow` on `/search`; `noindex, nofollow` on `/cart`, `/checkout`, `/orders/*`, `/track`, `/wishlist` (also sent as `X-Robots-Tag`) |
| Non-production | Every response carries `X-Robots-Tag: noindex, nofollow` unless `PUBLIC_SITE_URL` is the production host; `robots.txt` there is `Disallow: /` |
| hreflang | Emitted only when more than one locale is supported: `<link rel="alternate" hreflang="en-PK" href=…>`, `hreflang="ur-PK"`, and `x-default` → English |
| Pagination | A `?cursor=` page is `noindex, follow` with canonical to the first page (products are reachable through the sitemap and category links) |

## 4. Structured data (JSON-LD)

Rendered server-side as one `<script type="application/ld+json">` per object, built from typed helpers in `features/seo/jsonld.ts`. The JSON is serialised with `<` escaped as `<`.

| Page | Objects |
|---|---|
| All | `Organization` (name, url, logo, `sameAs` socials, `contactPoint` with phone) and `WebSite` (name, url, `potentialAction` SearchAction → `/search?q={search_term_string}`), on the home page only |
| Category, collection | `BreadcrumbList`; `ItemList` of the first 24 products (position, url) |
| Product | `BreadcrumbList` + `Product` (or `ProductGroup`, below) |
| CMS page | `BreadcrumbList`; `FAQPage` only for a page whose body is written as question headings + answers and whose slug is `faq` |

Product markup. Google's merchant-listing documentation requires `price`, `priceCurrency` and `availability` on the offer for price/stock rich results, and documents `ProductGroup` + `hasVariant` for products sold in sizes (sources in DOC-02 §4).

| Case | Markup |
|---|---|
| One variant | `Product` with one `Offer` |
| Several variants (sizes) | `ProductGroup` (`productGroupID` = product id, `variesBy: ["https://schema.org/size"]`) with `hasVariant[]`: one `Product` per variant (`sku`, `size`, `offers`) |
| Colourways | Each colourway is its own page and its own `ProductGroup`; siblings are linked with `isVariantOf` → shared `ProductGroup` id `styleId` only when `styleId` is set |

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Embroidered Lawn 3-Piece – Teal",
  "sku": "LWN-3P-TEAL-M",
  "image": ["https://img.rubaya.pk/…/1200x1600/…"],
  "description": "…",
  "brand": { "@type": "Brand", "name": "Rubaya" },
  "color": "Teal",
  "material": "Lawn",
  "size": "M",
  "offers": {
    "@type": "Offer",
    "url": "https://www.rubaya.pk/p/embroidered-lawn-3-piece-teal",
    "price": "6990.00",
    "priceCurrency": "PKR",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition"
  },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "38" }
}
```

| Field | Rule |
|---|---|
| `price` | Decimal **string** produced by `moneyToDecimalString(money)` in `@noor/contract` (integer paisa → `"6990.00"` by string padding, no float division) |
| `availability` | `in_stock`/`low_stock` → `InStock`; `sold_out` → `OutOfStock`; `preorder` → `PreOrder`; `made_to_order` → `MadeToOrder` |
| `priceValidUntil` | Only when the price comes from a promotion with an end date |
| `aggregateRating` | Only when there is at least one approved review; never fabricated |
| Sale price | `offers.price` is the current price; the compare-at price goes in `priceSpecification` with `priceType: StrikethroughPrice` |

## 5. Filtered and sorted listing URLs

| URL kind | Robots | Canonical |
|---|---|---|
| Category/collection with no params | index | itself |
| With `sort` only | `noindex, follow` | the unparameterised URL |
| With exactly **one** facet value from an attribute marked `seoIndexable` in the category's filter schema (e.g. `/c/lawn?attr.fabric=cotton`) | index | itself (canonical param order, DOC-06.1 §5) |
| Any other filter combination, any price or availability filter | `noindex, follow` | the unparameterised URL |

This keeps a small, deliberate set of filter pages indexable ("cotton lawn") and the combinatorial rest out of the index. Filter links in the page are normal links; no `nofollow` on internal links.

## 6. Sitemaps and robots

| File | Content |
|---|---|
| `/sitemap.xml` | Sitemap index listing `/sitemap-1.xml` … |
| `/sitemap-:n.xml` | Up to 5,000 URLs each, from `seo.listSitemapEntries` (cursor): home, categories, collections, active products (`lastmod` = `updatedAt`, plus `<image:image>` for the primary image), active CMS pages, `/new`, `/sale`, `/size-guide`, and the indexable single-facet URLs of §5. No `priority`/`changefreq` |
| `/robots.txt` | `Allow: /`; `Disallow:` `/cart`, `/checkout`, `/orders/`, `/track`, `/wishlist`, `/search`; `Sitemap: <PUBLIC_SITE_URL>/sitemap.xml` |

At A-03 scale (about 3,000 products) this is one or two sitemap files. Both are resource routes with `s-maxage=3600`.

## 7. Social previews

| Tag | Value |
|---|---|
| `og:type` | `product` on the PDP, `website` elsewhere |
| `og:title`, `og:description` | Same as title (without the brand suffix) and description |
| `og:image` | 1200 × 630 crop from the image transform: product primary image; category image; else `brand.logo` on the brand background. `og:image:width/height/alt` set |
| `og:url` | Canonical |
| `og:site_name`, `og:locale` | Brand; `en_PK` / `ur_PK` |
| `product:price:amount`, `product:price:currency` | PDP only (WhatsApp and Facebook previews read these) |
| `twitter:card` | `summary_large_image` |

WhatsApp is the main sharing channel for this market, so the PDP preview (title, price, image under 300 kB) is checked by hand on a phone before launch.

## 8. Content rules that affect SEO

- One `<h1>` per page; headings in order.
- Product and category handles: lower-case, hyphenated, ASCII, ≤ 70 characters, generated from the title and editable by staff; changing one creates a redirect (DOC-06.1 §4).
- Images: descriptive `alt`; file URLs are stable (transform parameters in the path, ADR-0011).
- Internal links are real `<a href>`; nothing that should be crawled is reachable only through JavaScript.
- Out-of-stock products stay live (200) with `OutOfStock`; archived products return 404.

## 9. Rules

**Always:** generate meta through `buildMeta`; emit JSON-LD from the same loader data the page renders; keep canonical URLs lower-case and parameter-free except the allowed single facet.
**Never:** mark up a rating, price or availability the page does not show; index search results, carts or order pages; emit a float price; block CSS or JS in `robots.txt`.
**Common mistakes:** a canonical that includes `?cursor=`; `InStock` for a sold-out variant; different title in `<title>` and `og:title` beyond the brand suffix; forgetting the staging `noindex`.

## 10. Acceptance checklist

- [ ] For one URL of each indexable page type, `curl` shows a unique `<title>`, a meta description, one canonical and the JSON-LD objects of §4.
- [ ] Product JSON-LD passes Google's Rich Results Test for one single-variant and one multi-size product (manual, recorded in the PR).
- [ ] `/search?q=x` and `/cart` send `X-Robots-Tag: noindex`.
- [ ] A staging deploy serves `Disallow: /` and `X-Robots-Tag: noindex` on every page.
- [ ] `/sitemap.xml` lists every active product exactly once and no draft or archived one.
- [ ] `/c/lawn?sort=price_asc` is `noindex` with canonical `/c/lawn`.
- [ ] Sharing a PDP link in WhatsApp shows title, price and image.

## 11. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.9-1 | `seoIndexable` flag on attributes, `seo` on category | Added in DOC-09 catalog | DOC-09 |
| Q-06.9-2 | Google merchant-listing requirements | From Google Search Central pages seen via search summaries (Oct 2026), not read in full | Rich Results Test at implementation |
| Q-06.9-3 | Production domain | **Answered (README A-08): `rubaya.pk`**, go-live later. Until then `PUBLIC_SITE_URL` is the local URL and every response is `noindex` (§3) | Go-live date set |
| Q-06.9-4 | Google Merchant Center feed | Out of this doc (DOC-12) | — |

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Owner answer: domain `rubaya.pk` (A-08) |

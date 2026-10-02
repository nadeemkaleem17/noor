# 10.2 — API: Catalog (public)

| Field | Value |
|---|---|
| ID | DOC-10.2 |
| Title | Product listings and search, product detail, categories, collections, size charts, reviews (read), sitemap data |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-09.3, DOC-09.5, DOC-06.3, DOC-06.4, DOC-06.9 |
| Decisions used | ADR-0005, ADR-0010, ADR-0011, ADR-0013, ADR-0014, ADR-0018 |

## 1. Purpose and scope

**Governs:** public read endpoints of `catalog`, `search` and `reviews`.
**Does not govern:** carts and orders (DOC-10.3), admin catalog (DOC-10.5).

All endpoints: auth `public`; `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` unless noted; accept `?locale=`. Only `active` products, visible categories and active collections inside their window are ever returned.

## 2. Endpoints

| Key | Method & path | Request | Response | Errors | Notes |
|---|---|---|---|---|---|
| `catalog.listProducts` | `GET /products` | Q: `ListingQuery` | 200 `ProductListing` | `not_found` (unknown category/collection handle) | Bucket `default` (`search` when `q` is set, and then `Cache-Control: private, no-store`). Tags `listing`, `category:<id>` or `collection:<id>` |
| `catalog.getProduct` | `GET /products/:handleOrId` | P; Q: `preview?` (signed token, DOC-11 §9) | 200 `ProductDetail` or 200 `{ redirectTo: string }` (old handle) | `not_found` (draft, archived, unknown) | Tag `product:<handle>`. With a valid `preview` token: any status, `no-store` |
| `catalog.listRelated` | `GET /products/:id/related` | Q: `limit?` (4–8, default 8) | 200 `{ items: ProductSummary[] }` | `not_found` | `relatedIds` first, then same primary category by `sales_count` |
| `catalog.listCategories` | `GET /categories` | — | 200 `{ items: CategoryNode[] }` | — | Tag `categories`. Full visible tree |
| `catalog.getCategory` | `GET /categories/:handle` | P | 200 `CategoryDetail` or `{ redirectTo }` | `not_found` | Tag `category:<id>` |
| `catalog.listCollections` | `GET /collections` | Q: `featured?: 1`, `limit?` (≤ 24) | 200 `{ items: CollectionSummary[] }` | — | |
| `catalog.getCollection` | `GET /collections/:handle` | P | 200 `CollectionDetail` or `{ redirectTo }` | `not_found` | Tag `collection:<id>` |
| `catalog.listSizeCharts` | `GET /size-charts` | — | 200 `{ items: SizeChart[] }` | — | Tag `size-charts` |
| `catalog.getSizeChart` | `GET /size-charts/:id` | P | 200 `SizeChart` | `not_found` | |
| `catalog.getFormSchema` | `GET /form-schemas/:id` | P | 200 `FormSchema` | `not_found` | Custom-size form |
| `catalog.subscribeBackInStock` | `POST /variants/:id/stock-subscriptions` | B: `{ phone: PkMobile, locale? }` | 204 | `not_found`, `variant_unavailable` (not sold out, or made-to-order) | Bucket `notify`. Always 204 for a repeat subscription. Only when `features.notifyMe` |
| `reviews.listForProduct` | `GET /products/:id/reviews` | Q: `limit?` (≤ 20, default 5), `cursor?` | 200 `ReviewListing` | `not_found` | Tag `product:<handle>`. Approved only |
| `seo.listSitemapEntries` | `GET /sitemap-entries` | Q: `limit?` (≤ 5000), `cursor?` | 200 `CursorPage<SitemapEntry>` | — | `s-maxage=3600` |

## 3. Listing query and response

```ts
ListingQuery = {
  category?: string,            // handle; includes descendants
  collection?: string,          // handle
  ids?: Id[],                   // max 100 (wishlist); when set, all other filters are ignored and order follows ids
  q?: string,                   // 2–80 chars; text search (DOC-09.5 §3)
  onlyNew?: 1,                  // published within 30 days
  onlySale?: 1,                 // has a compare-at price
  kind?: ProductKind[],
  size?: string[],              // size labels; matches products with an available variant in that size
  color?: ColorFamily[],
  inStock?: 1,                  // excludes sold_out
  priceMin?: int, priceMax?: int,          // paisa, against price_min_minor
  [`attr.${code}`]?: string[],  // attribute value codes
  sort?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'bestselling' | 'relevance',
  limit?: int,                  // 1–48, default 24
  cursor?: string,
  facets?: 0 | 1,               // default 1; 0 skips facet computation ("load more" requests)
}
```

Defaults for `sort`: `relevance` when `q` is set; `featured` with `category` or `collection`; otherwise `newest`. `relevance` without `q` is `400`. `featured` = collection order (inside a collection) or `featured_rank DESC, published_at DESC`.

```ts
ProductListing = {
  items: ProductSummary[],
  total: int,
  nextCursor?: string,
  facets?: Facet[],             // computed for the current filter set (ADR-0010); absent when facets=0
  pricePresets?: { min?: int, max?: int }[],      // four ranges from the price distribution
}

ProductSummary = {
  id: Id, handle: string, title: string, brand?: string, kind: ProductKind,
  primaryImage: Image, secondaryImage?: Image,
  priceFrom: Money, priceTo?: Money,              // priceTo only when it differs
  compareAtFrom?: Money,
  badges: ('new' | 'sale' | 'bestseller' | 'limited' | 'made_to_order' | 'sold_out')[],
  stockStatus: StockStatus,
  colorways: { handle: string, label: string, swatch: Swatch, current: boolean }[],   // siblings incl. itself; empty when no style
  rating?: { average: number /* one decimal */, count: int },
}

Facet = {
  key: string,                  // 'size' | 'color' | 'kind' | 'inStock' | `attr.${code}`
  label: string,
  display: 'checkbox' | 'swatch' | 'buttons' | 'range',
  values: { value: string, label: string, count: int, swatch?: Swatch, selected: boolean }[],
  seoIndexable?: boolean,       // attribute facets only (DOC-06.9 §5)
}
```

Facet rules: counts are for the current filter set **excluding the facet's own selection** (so a customer sees how many each other value would give); values with count 0 stay in the list; attribute facets are those of the category's (or inherited) `category_attributes`, in their order; outside a category (search, `/new`, `/sale`, collection) the facets are `kind`, `size`, `color`, price and `inStock` only.

## 4. Product detail

```ts
ProductDetail = {
  id: Id, handle: string, kind: ProductKind, status: ProductStatus,      // status only differs from 'active' in preview
  title: string, subtitle?: string, brand?: string,
  descriptionMd?: string, highlights: string[], care: string[],
  breadcrumb: { handle: string, name: string }[],                         // primary category path
  media: (Image & { id: Id, kind: 'image' | 'video', role?: MediaRole, videoSrc?: string, optionValueId?: Id })[],
  options: { id: Id, name: string, role: OptionRole, display: OptionDisplay,
             values: { id: Id, label: string, kind: 'standard' | 'custom', swatch?: Swatch }[] }[],
  variants: { id: Id, sku: string, optionValueIds: Id[], price: Money, compareAt?: Money,
              stockStatus: StockStatus, available?: int,                  // present for counted stock, capped at maxPerOrder
              maxPerOrder: int, preorderShipsAt?: string }[],             // enabled variants only
  components: Component[],                                                // unstitched "what's included"
  attributes: { group?: string, label: string, values: string[] }[],      // display form
  colorway?: { label: string, family: ColorFamily, swatch: Swatch },
  siblings: { handle: string, label: string, swatch: Swatch, image: Image, current: boolean }[],
  sizeChartId?: Id, customSizeSchemaId?: Id,
  fit?: Fit,
  madeToOrder?: { leadMinDays: int, leadMaxDays: int, label: string, returnable: boolean, depositPercent?: number },
  bundle?: { items: { product: ProductSummary, options: ProductDetail['options'], variants: ProductDetail['variants'] }[] },
  badges: ProductSummary['badges'],
  rating?: { average: number, count: int, fit?: { runsSmall: int, trueToSize: int, runsLarge: int } },
  delivery: { etaMinDays?: int, etaMaxDays?: int, codAvailable: boolean, freeAbove?: Money },   // from the default zone's cheapest method
  seo: { title?: string, description?: string },
  updatedAt: IsoDate,
}
```

`available` deliberately stops at `maxPerOrder` (a customer cannot learn that 4,000 units exist). `depositPercent` is `mto_deposit_bps / 100`.

## 5. Other schemas

```ts
CategoryNode = { id: Id, handle: string, name: string, image?: Image, productCount: int, children: CategoryNode[] }
CategoryDetail = { id: Id, handle: string, name: string, description?: string, image?: Image,
                   breadcrumb: { handle: string, name: string }[], children: { handle: string, name: string }[],
                   seo: { title?: string, description?: string } }
CollectionSummary = { id: Id, handle: string, title: string, image?: Image }
CollectionDetail = CollectionSummary & { description?: string, seo: { title?: string, description?: string } }
SizeChart = { id: Id, title: string, unit: 'in' | 'cm', notes?: string, guideImage?: Image,
              tables: { id: string, title: string, columns: string[], rows: { label: string, values: number[] }[] }[] }
FormSchema = { id: Id, title?: string, fields: FormField[], allowNotes: boolean }        // contract FormField
ReviewListing = CursorPage<ReviewPublic> & { summary: { average: number, count: int, byStar: [int, int, int, int, int] } }
ReviewPublic = { id: Id, displayName: string, rating: int, title?: string, body: string, fit?: FitNote,
                 photos: Image[], createdAt: IsoDate, reply?: { body: string, createdAt: IsoDate } }
SitemapEntry = { loc: string /* path */, lastmod: IsoDate, image?: string, type: 'home' | 'category' | 'collection' | 'product' | 'page' | 'facet' }
```

## 6. Examples

```http
GET /api/v1/products?category=lawn&attr.fabric=cotton&size=M&sort=newest&limit=24

200 OK
{ "items": [ { "id": "0192…", "handle": "embroidered-lawn-3-piece-teal", "title": "Embroidered Lawn 3-Piece",
               "kind": "unstitched",
               "primaryImage": { "src": "https://img…/w640…", "srcset": "… 320w, … 640w", "width": 900, "height": 1200, "alt": "Teal embroidered lawn suit, front" },
               "priceFrom": { "amount": 699000, "currency": "PKR" },
               "compareAtFrom": { "amount": 849000, "currency": "PKR" },
               "badges": ["sale"], "stockStatus": "in_stock",
               "colorways": [ { "handle": "embroidered-lawn-3-piece-teal", "label": "Teal", "swatch": { "hex": ["#1F6F6B"] }, "current": true } ] } ],
  "total": 52, "nextCursor": "eyJwIjoi…",
  "facets": [ { "key": "attr.fabric", "label": "Fabric", "display": "checkbox", "seoIndexable": true,
                "values": [ { "value": "cotton", "label": "Cotton", "count": 52, "selected": true },
                            { "value": "khaddar", "label": "Khaddar", "count": 18, "selected": false } ] } ] }
```

```http
GET /api/v1/products/old-handle

200 OK
{ "redirectTo": "embroidered-lawn-3-piece-teal" }
```

## 7. Rules

**Always:** compute items and facets with one query builder so filters cannot diverge; cap `limit`; resolve redirects in the API; return only enabled variants and active products.
**Never:** return an unpaginated product array (F-12); expose exact stock above `maxPerOrder`, cost, internal flags or non-active siblings; accept a sort or filter not in `ListingQuery`.
**Common mistakes:** facet counts that include the facet's own selection (all other values then show 0); a cursor that breaks when two products share the sort value (the cursor carries the id as tie-breaker); caching search responses.

## 8. Acceptance checklist

- [ ] Listing for 3,000 seeded products: page of 24 with facets ≤ 60 kB gzip and under 100 ms at the database (ADR-0010, DOC-09.3 §9).
- [ ] Walking all pages with the cursor returns every product exactly once while a product is published mid-walk.
- [ ] `facets=0` skips the facet queries (asserted by query count).
- [ ] An archived product is `404` on `getProduct` and absent from listings, related, siblings and the sitemap.
- [ ] `available` never exceeds `maxPerOrder`.
- [ ] `sort=relevance` without `q` → `400`; `attr.unknown=x` → `400`.
- [ ] A preview token for product A does not open product B and expires after 15 minutes.

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.2-1 | Price presets | Quartile boundaries rounded to Rs. 500 | Owner prefers fixed ranges |
| Q-10.2-2 | `ProductDetail` size for a 100-variant product | Under 40 kB gzip | Larger → paginate variants |
| Q-10.2-3 | Bundle children returned in full inside the bundle | Yes (2–6 children) | Payload too large |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 2). Final shapes for `ProductSummary` and listing params (camelCase: `priceMin`, `inStock`; DOC-06.3 used provisional `price_min`, `in_stock`) |

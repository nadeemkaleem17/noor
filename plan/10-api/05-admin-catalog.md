# 10.5 — API: Admin Catalog, Media and Inventory

| Field | Value |
|---|---|
| ID | DOC-10.5 |
| Title | Products, variants, media uploads, inventory, categories, collections, attributes, sizes, forms |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-10.0, DOC-09.3, DOC-09.4, DOC-07.3, DOC-07.4, DOC-08 §11 |
| Decisions used | ADR-0011, ADR-0013, ADR-0014, ADR-0018, ADR-0020 |

## 1. Purpose and scope

**Governs:** admin endpoints of `catalog`, `media` and `inventory`.
**Does not govern:** the editor behaviour (DOC-07.3, 07.4).

All paths under `/api/v1/admin`; auth `staff`; `no-store`; every non-GET writes an audit entry. Bucket `admin` unless stated.

## 2. Products

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.products.list` | `GET /products` | `products:read` | Q: `q?`, `status?`, `category?: Id`, `collection?: Id`, `kind?`, `stock?: 'in' \| 'low' \| 'sold_out' \| 'mto'`, `hasIssues?: 1`, `page`, `size`, `sort` (`title`, `status`, `quantity`, `price`, `updatedAt`; default `-updatedAt`) | 200 `Page<AdminProductRow>` | — | |
| `admin.products.get` | `GET /products/:id` | `products:read` | — | 200 `AdminProduct` | `not_found` | |
| `admin.products.create` | `POST /products` | `products:write` (+ `products:publish` if status is `active`/`scheduled`) | B: `ProductInput` (+ `initialStock?: { variantKey: string, quantity: int }[]`) | 201 `AdminProduct` | `handle_taken`, `sku_taken`, `publish_checks_failed`, `media_not_ready` | |
| `admin.products.update` | `PUT /products/:id` | same | B: `ProductInput & { version: int }` | 200 `AdminProduct` | `stale_write`, `handle_taken`, `sku_taken`, `publish_checks_failed`, `in_use` (removing a variant that has order lines) | Whole document. Variants are matched by `id`; a variant without `id` is created; one missing from the body is deleted if unused |
| `admin.products.delete` | `DELETE /products/:id` | `products:delete` | — | 204 | `in_use` (has order lines → archive instead) | |
| `admin.products.duplicate` | `POST /products/:id/duplicate` | `products:write` | — | 201 `AdminProduct` | — | Draft copy, handle `-copy`, blank SKUs, zero stock |
| `admin.products.checkSku` | `GET /products/sku-available` | `products:read` | Q: `sku`, `exceptVariantId?` | 200 `{ available: boolean }` | — | |
| `admin.products.checks` | `POST /products/publish-checks` | `products:read` | B: `ProductInput` | 200 `{ checks: { code: string, path?: string, ok: boolean }[] }` | — | Same function the save uses (DOC-07.3 §8) |
| `admin.products.previewLink` | `POST /products/:id/preview-link` | `products:read` | — | 200 `{ url: string, expiresAt: IsoDate }` | — | 15-minute signed link |
| `admin.products.bulk` | `POST /products/bulk` | per action | B: bulk body (DOC-10.0 §10); `action`: `publish`, `unpublish`, `archive`, `delete`, `add_to_collection` (`params.collectionId`), `remove_from_collection` | 200 bulk result or 202 | `selection_changed` | Bucket `adminExport` |
| `admin.products.export` | `POST /products/exports` | `products:export` | B: list filters | 200 CSV (≤ 1,000 rows) or 202 `{ jobId }` | — | One row per variant (DOC-07.3 §10) |
| `admin.products.importPreview` | `POST /products/imports/preview` | `products:write` + `inventory:adjust` | B: `{ rows: { sku, price?, compareAt?, stockSet? }[] }` (≤ 5,000; parsed from CSV in the browser) | 200 `{ rows: { sku, ok: boolean, code?: string, changes?: {…} }[], token: string }` | — | Writes nothing |
| `admin.products.importApply` | `POST /products/imports` | same | B: `{ token: string }` | 202 `{ jobId }` | `token_expired` | Applies exactly the previewed rows |

```ts
ProductInput = {
  handle: string, status: ProductStatus, publishAt?: IsoDate, kind: ProductKind,
  title: string, subtitle?: string, brand?: string, descriptionMd?: string,
  highlights?: string[], care?: string[], components?: Component[],
  primaryCategoryId: Id, categoryIds: Id[],
  attributes: { attributeId: Id, valueIds?: Id[], number?: int }[],
  styleId?: string, colorway?: { label: string, family: ColorFamily, swatch: Swatch },
  media: { mediaId: Id, alt: string, role?: MediaRole, optionValueKey?: string }[],      // order = gallery order
  options: { id?: Id, name: string, role: OptionRole, display: OptionDisplay, sizeSystemId?: Id,
             values: { id?: Id, key: string /* client temp key */, label: string, kind?: 'standard' | 'custom',
                       sizeSystemValueId?: Id, swatch?: Swatch }[] }[],
  variants: { id?: Id, key: string, sku: string, optionValueKeys: string[], price: Money, compareAt?: Money,
              stockMode: StockMode, preorderShipsAt?: string, maxPerOrder: int, enabled: boolean }[],
  sizeChartId?: Id, customSizeSchemaId?: Id, fit?: Fit,
  madeToOrder?: { leadMinDays: int, leadMaxDays: int, label: string, returnable: boolean, depositPercent?: number },
  bundleProductIds?: Id[], relatedIds?: Id[],
  badges?: ('new' | 'bestseller' | 'limited')[], featuredRank?: int,
  seo?: { title?: string, description?: string },
  i18n?: { ur?: { title?: string, subtitle?: string, descriptionMd?: string, highlights?: string[], care?: string[], colorwayLabel?: string } },
}

AdminProduct = ProductInput (with ids on options, values and variants; media as Image & { mediaId, role?, optionValueId? }) & {
  id: Id, version: int, createdAt: IsoDate, updatedAt: IsoDate, publishedAt?: IsoDate,
  variants: (… & { id: Id, stockStatus: StockStatus, onHand?: int, reserved?: int, hasOrders: boolean })[],
  siblings: { id: Id, handle: string, title: string, colorwayLabel: string, status: ProductStatus }[],
  collections: { id: Id, title: string }[],                        // read-only here; edited on the collection
  checks: { code: string, path?: string, ok: boolean }[],
  storefrontUrl?: string,
}

AdminProductRow = { id: Id, handle: string, title: string, colorwayLabel?: string, image?: Image, status: ProductStatus, kind: ProductKind,
                    primaryCategory: { id: Id, name: string }, variantCount: int, stockStatus: StockStatus, quantity?: int,
                    priceFrom: Money, priceTo?: Money, updatedAt: IsoDate, hasIssues: boolean }
```

Stock quantities are **not** part of `ProductInput` (DOC-07.3 §7.1); `initialStock` exists only on create.

## 3. Media

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.media.createUpload` | `POST /media/uploads` | `products:write` or `content:write` or `settings:write` | B: `{ filename: string, contentType: string, bytes: int }` | 200 `{ mediaId: Id, uploadUrl: string, headers: Record<string,string>, expiresAt: IsoDate }` | `validation_failed` (type not JPEG/PNG/WebP/AVIF/MP4/SVG, or over the size limit) | Bucket `upload`. Presigned `PUT`, 10 minutes |
| `admin.media.confirm` | `POST /media/:id/confirm` | same | — | 200 `MediaInfo` (`status: 'pending'`) | `not_found` | Enqueues `media.process` |
| `admin.media.get` | `GET /media/:id` | same | — | 200 `MediaInfo` | `not_found` | Polled until `ready` or `rejected` |
| `admin.media.update` | `PUT /media/:id` | same | B: `{ alt: string, i18n?: { ur?: { alt?: string } } }` | 200 `MediaInfo` | — | Default alt |
| `admin.media.delete` | `DELETE /media/:id` | same | — | 204 | `in_use` | |

```ts
MediaInfo = { id: Id, kind: 'image' | 'video', status: MediaStatus, rejectReason?: string,
              image?: Image, width?: int, height?: int, bytes: int, alt: string, createdAt: IsoDate }
```

## 4. Inventory

| Key | Method & path | Permission | Request | Response | Errors | Notes |
|---|---|---|---|---|---|---|
| `admin.inventory.adjust` | `POST /inventory/adjustments` | `inventory:adjust` | B: `{ variantId: Id, mode: 'add' \| 'remove' \| 'set', quantity: int (≥ 0), reason: 'restock' \| 'correction' \| 'damaged' \| 'return_restock' \| 'other', note?: string }` | 200 `{ variantId: Id, onHand: int, reserved: int, available: int, stockStatus: StockStatus }` | `stock_below_reserved`, `variant_unavailable` (not a counted variant) | `note` required for `damaged` and `other` |
| `admin.inventory.listMovements` | `GET /inventory/movements` | `products:read` | Q: `variantId?`, `productId?`, `reason?`, `from?`, `to?`, `page`, `size` | 200 `Page<Movement>` | — | Newest first |

```ts
Movement = { id: Id, variantId: Id, sku: string, productTitle: string, delta: int, onHandAfter: int,
             reason: MovementReason, note?: string, orderNumber?: string, staffName?: string, createdAt: IsoDate }
```

## 5. Categories

| Key | Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.categories.list` | `GET /categories` | `catalog:read` | — | 200 `{ items: AdminCategory[] }` (flat, with `parentId`, `sortOrder`, `productCount`) | — |
| `admin.categories.create` | `POST /categories` | `catalog:write` | B: `CategoryInput` | 201 `AdminCategory` | `handle_taken`, `validation_failed` (depth > 3) |
| `admin.categories.update` | `PUT /categories/:id` | `catalog:write` | B: `CategoryInput & { version }` | 200 `AdminCategory` | `stale_write`, `handle_taken`, `validation_failed` (cycle or depth) |
| `admin.categories.reorder` | `POST /categories/reorder` | `catalog:write` | B: `{ parentId: Id \| null, orderedIds: Id[] }` | 204 | `validation_failed` (ids are not exactly the children) |
| `admin.categories.delete` | `DELETE /categories/:id` | `catalog:delete` | — | 204 | `in_use` (children, or primary category of products) |

```ts
CategoryInput = { name: string, handle: string, parentId?: Id | null, description?: string, imageMediaId?: Id | null, visible: boolean,
                  attributes: { attributeId: Id, seoIndexable: boolean, required: boolean }[],     // order = facet order; [] = inherit
                  seo?: { title?: string, description?: string }, i18n?: { ur?: { name?: string, description?: string } } }
AdminCategory = CategoryInput & { id: Id, sortOrder: int, productCount: int, image?: Image, version: int }
```

## 6. Collections

| Key | Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.collections.list` | `GET /collections` | `catalog:read` | Q: `q?`, `status?`, `page`, `size`, `sort` | 200 `Page<AdminCollectionRow>` | — |
| `admin.collections.get` | `GET /collections/:id` | `catalog:read` | — | 200 `AdminCollection` | `not_found` |
| `admin.collections.create` | `POST /collections` | `catalog:write` | B: `CollectionInput` | 201 `AdminCollection` | `handle_taken` |
| `admin.collections.update` | `PUT /collections/:id` | `catalog:write` | B: `CollectionInput & { version }` | 200 `AdminCollection` | `stale_write`, `handle_taken`, `validation_failed` (a fourth featured: `details.featured`) |
| `admin.collections.delete` | `DELETE /collections/:id` | `catalog:delete` | — | 204 | — |

```ts
CollectionInput = { title: string, handle: string, description?: string, imageMediaId?: Id | null, status: 'draft' | 'active',
                    featured: boolean, replaceFeaturedId?: Id,          // which featured collection to un-feature when a fourth is set
                    startsAt?: IsoDate, endsAt?: IsoDate, productIds: Id[] /* ordered, ≤ 500 */,
                    seo?: { title?: string, description?: string }, i18n?: {…} }
AdminCollection = CollectionInput & { id: Id, version: int, image?: Image, products: AdminProductRow[] }
AdminCollectionRow = { id: Id, title: string, handle: string, status: string, featured: boolean, productCount: int, updatedAt: IsoDate }
```

## 7. Attributes, sizes and forms

| Key | Method & path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.attributes.list` | `GET /attributes` | `catalog:read` | — | 200 `{ items: AdminAttribute[] }` | — |
| `admin.attributes.create` | `POST /attributes` | `catalog:write` | B: `AttributeInput` | 201 `AdminAttribute` | `code_taken` |
| `admin.attributes.update` | `PUT /attributes/:id` | `catalog:write` | B: `AttributeInput` (`code`, `type` ignored if changed → `validation_failed`) | 200 `AdminAttribute` | `in_use` (removing a value used by products) |
| `admin.attributes.mergeValue` | `POST /attributes/:id/values/:valueId/merge` | `catalog:write` | B: `{ intoValueId: Id }` | 204 | `not_found` |
| `admin.attributes.delete` | `DELETE /attributes/:id` | `catalog:delete` | — | 204 | `in_use` |
| `admin.sizeSystems.list` / `.create` / `.update` / `.delete` | `GET\|POST /size-systems`, `PUT\|DELETE /size-systems/:id` | `catalog:read` / `write` / `delete` | B: `{ name: string, values: { id?: Id, label: string }[] }` (order = size order) | `AdminSizeSystem` | `in_use` |
| `admin.sizeCharts.list` / `.get` / `.create` / `.update` / `.delete` | `GET\|POST /size-charts`, `GET\|PUT\|DELETE /size-charts/:id` | same | B: `SizeChartInput & { version? }` | `AdminSizeChart` (+ `usedBy: int`) | `stale_write` |
| `admin.formSchemas.list` / `.get` / `.create` / `.update` / `.delete` | `GET\|POST /form-schemas`, `GET\|PUT\|DELETE /form-schemas/:id` | same | B: `{ title: string, fields: FormField[], allowNotes: boolean, version? }` | `AdminFormSchema` (+ `usedBy: int`) | `stale_write`, `in_use`, `validation_failed` (a field `key` changed) |

```ts
AttributeInput = { code: string, label: string, type: AttributeType, display: AttributeDisplay, filterable: boolean, group?: string,
                   values: { id?: Id, code: string, label: string, swatch?: Swatch }[], i18n?: {…} }
AdminAttribute = AttributeInput & { id: Id, usedByProducts: int, usedByCategories: int,
                                    values: (… & { id: Id, usedByProducts: int })[] }
SizeChartInput = { title: string, sizeSystemId?: Id, unit: 'in' | 'cm', notes?: string, guideMediaId?: Id | null,
                   tables: { id: string, title: string, columns: string[], rows: { label: string, values: number[] }[] }[] }
```

## 8. Example

```http
POST /api/v1/admin/inventory/adjustments
X-CSRF-Token: …
{ "variantId": "0192f5aa-…", "mode": "remove", "quantity": 5, "reason": "damaged", "note": "water damage" }

409 Conflict
{ "type": "https://rubaya.pk/problems/stock_below_reserved", "title": "Stock below reserved", "status": 409,
  "code": "stock_below_reserved", "requestId": "…", "reserved": 3 }
```

## 9. Rules

**Always:** save a product as one document with `version`; match variants by id; run the same publish checks on save as on the checks endpoint; return `usedBy` counts so the UI can explain a blocked delete.
**Never:** accept stock quantities in `ProductInput` (other than `initialStock` on create); let an update change an attribute `code`/`type` or a form field `key`; delete referenced rows (return `in_use`).
**Common mistakes:** recreating all variants on every save (loses ids referenced by orders and carts); returning `mediaId` without the `Image` the UI needs to preview it.

## 10. Acceptance checklist

- [ ] Updating a product with one new size keeps every existing variant id.
- [ ] Saving with a stale `version` → `409 stale_write` and nothing changed.
- [ ] `admin.products.update` to `active` with a missing alt → `409 publish_checks_failed` listing the path.
- [ ] `admin.inventory.adjust` never produces `on_hand < reserved`.
- [ ] Import: the applied rows equal the previewed rows even if the CSV changes in between (token-bound).
- [ ] A `catalog` role can call every route here except `admin.products.delete`; a `fulfilment` role only `admin.products.list/get`, `admin.inventory.*` (matrix test).

## 11. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-10.5-1 | Whole-document product save | Fine up to 100 variants | DOC-10.0 Q-10.0-2 |
| Q-10.5-2 | CSV parsed in the browser | Keeps file handling out of the API; 5,000-row cap | Larger imports → upload to storage and parse in a job |
| Q-10.5-3 | Video uploads (MP4 ≤ 30 MB) | Same presign flow, no transcoding | Videos needed in multiple qualities |

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 5, part 2) |

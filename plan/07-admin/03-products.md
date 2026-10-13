# 07.3 — Admin: Products and Variants

| Field | Value |
|---|---|
| ID | DOC-07.3 |
| Title | Product list, product editor, options and variants, media, stock, publishing |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.14, DOC-04c §3, DOC-05 §3, DOC-06.4 |
| Decisions used | ADR-0011, ADR-0013, ADR-0014, ADR-0018, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/products`, `/products/new`, `/products/:id`: every field staff can edit, how the editor adapts to the product kind, how variants are generated, how stock is changed, and publishing rules.
**Does not govern:** table mechanics and bulk actions (DOC-07.14); the product schema and tables (contract, DOC-09 catalog); what the storefront shows (DOC-06.4).

Keeps the existing editor's domain coverage (`ProductEditor.jsx`, `OptionsVariantsEditor.jsx`, `ComponentsEditor.jsx`, `MediaEditor.jsx`), replaces its data layer and layout.

## 2. Product list (`/products`)

| Column | Content | Sortable |
|---|---|---|
| ☐ | Selection | |
| Product | Thumbnail, title, colourway label, SKU count ("4 variants") | title |
| Status | `StatusBadge` (draft / scheduled / active / archived) | yes |
| Stock | Aggregate badge (in stock / low / sold out / made to order) + total counted quantity | quantity |
| Price | `Rs. 6,990` or `Rs. 6,990 – 7,490` | lowest price |
| Category | Primary category | |
| Kind | stitched / unstitched / … | |
| Updated | Relative time | yes (default, descending) |
| ⋯ | Row menu: Edit, Duplicate, View on storefront, Archive, Delete | |

Filters (URL params): search `q` (title, handle, SKU), `status`, `category` (includes descendants), `collection`, `kind`, `stock` (`in`, `low`, `sold_out`, `mto`), `hasIssues` (products with publish-blocking problems). Page size 50. Bulk actions: Publish, Unpublish (to draft), Archive, Add to collection, Remove from collection, Delete, Export CSV (DOC-07.14 §6).

Header actions: **New product** (primary), Import CSV, Export CSV.

## 3. Editor layout

One form (`useForm`, schema = contract `Product` input schema), one Save. Two columns from `lg`.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ← Products › Embroidered Lawn 3-Piece            [View] [Duplicate] [⋯] [Save]  │
├───────────────────────────────────────────────────┬─────────────────────────────┤
│ Basics            title, subtitle, brand, desc.   │ Status   draft ▾            │
│ Media             gallery grid, upload            │  Publish at  [date time]    │
│ Kind-specific     components / fit / MTO / bundle │ Organisation                │
│ Options & variants                                │  Primary category ▾         │
│   option rows → variant table (SKU, price, stock) │  Also in categories         │
│ Attributes        from the category filter schema │  Collections                │
│ Details           highlights, care                │  Kind  stitched ▾           │
│ Colourway         style id, colour, siblings      │  Badges                     │
│ Related products                                  │ Sizing                      │
│ SEO               title, description, handle      │  Size chart ▾  Fit note ▾   │
│                                                   │ Checks   ✓ ready to publish │
└───────────────────────────────────────────────────┴─────────────────────────────┘
│ Unsaved changes                                         [Discard]  [Save]       │ sticky bar when dirty
```

Sections are `Card`s on one scrolling page with an in-page section list at the top (anchors); no tabs, so browser find and validation jumps work.

## 4. Fields

| Section | Field | Control | Rules |
|---|---|---|---|
| Basics | Title | `Input` | Required, 3–120 |
| | Subtitle | `Input` | ≤ 160 |
| | Brand | `Input` | ≤ 60 |
| | Description | Markdown `Textarea` with Preview toggle | ≤ 5,000; rendered on the storefront with the DOC-06.8 allow-list |
| Media | Gallery | `ImageUpload` grid | §6 |
| Organisation | Primary category | `Combobox` (tree paths) | Required |
| | Additional categories, Collections | Multi `Combobox` | |
| | Kind | `NativeSelect` | Required; changing kind after variants have orders asks for confirmation and keeps data of hidden sections until saved |
| | Badges | Checkboxes: new, bestseller, limited | `sale`, `sold_out`, `made_to_order` are **derived** by the API (compare-at price, stock, kind) and not editable |
| Attributes | One control per attribute in the primary category's `filterSchema` | By `AttributeDefinition.display`: checkbox list, swatches, buttons, number | Values come from the attribute's value list; no free text |
| Details | Highlights | Repeating `Input` rows | Max 6, each ≤ 120 |
| | Care instructions | Repeating `Input` rows | Max 8 |
| Colourway | Style id | `Combobox` over existing style ids + "create" | Products sharing it are siblings |
| | Colour name, colour family, swatch | `Input`, `NativeSelect`, colour picker (1–2 hex) or "use an image" | Required when style id is set |
| | Siblings | Read-only list of the other products in the style with links | |
| Related | Related products | Multi `Combobox` (async product search) | Max 8 |
| SEO | Handle | `Input` with "regenerate from title" | Required, unique, `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 70. Changing a published handle shows "The old link will redirect" (DOC-06.1 §4) |
| | SEO title, SEO description | `Input`, `Textarea` | ≤ 60, ≤ 160, with a search-result preview |
| Status | Status | `NativeSelect` | §8 |
| | Publish at | date-time | Only for `scheduled`; must be in the future; shown in Asia/Karachi |

Urdu content fields (`title`, `subtitle`, `descriptionMd`, `highlights`, `care`, media `alt`) get an "Urdu" sub-field each **only when** `ur` is in `StoreConfig.locale.supported` (ADR-0018).

## 5. Kind-specific sections

| Kind | Section shown | Fields |
|---|---|---|
| `unstitched` | What's included (components) | Rows: type (shirt, dupatta, trouser, shalwar, slip, lehnga, blouse, jacket, scarf, other), label, fabric, colour, technique, quantity ("3 m"), included toggle. Reorder with up/down buttons. At least one row required to publish |
| `stitched`, `footwear` | Sizing | Size chart (`Combobox`), fit note (runs small / true to size / runs large), cut, model height (cm), model wears |
| `made_to_order` | Made to order | Lead time min and max days, lead-time label (auto-filled "Made for you in 15–20 days", editable), returnable (checkbox), deposit % (0–100, blank = none), custom-size form (`Combobox` over form schemas) |
| `bundle` | In this set | Child products (async `Combobox`, 2–6); the bundle has one variant with the set price; child sizes are chosen by the customer |
| `accessory`, `home`, `beauty` | — | None |

`stitched` products may also have a components section (optional). Sections for other kinds are hidden, not disabled.

## 6. Media

| Rule | Detail |
|---|---|
| Upload | Drag-and-drop or button; JPEG, PNG, WebP, AVIF; ≤ 10 MB each; ≥ 1200 px on the long side (warning below, blocked below 800 px). Uploads go straight to object storage through a presigned URL from `admin.media.createUpload`, then `admin.media.confirm` records dimensions and content type after the server checks the file's magic bytes (ADR-0011, F-17) |
| Order | Up/down/"make primary" buttons plus drag reorder; the first image is the card image |
| Per image | Alt text (required to publish), role (model, flat, detail, lifestyle), "show for variant value" (links the image to an option value, e.g. a size or material) |
| Video | One optional video URL from our storage (MP4 ≤ 30 MB) with a poster image |
| Limits | 1–12 images |
| Progress and errors | Per-file progress bar; failed files stay in the grid with Retry/Remove; the form cannot be saved while an upload is in progress |
| Replace | Deleting an image used by an existing order line keeps the file in storage (orders reference their own copy of the URL, DOC-09) |

## 7. Options and variants

| Rule | Detail |
|---|---|
| Options | 0–3 rows. Each: name, role (`size`, `color`, `material`, `other`), display (`buttons`, `swatch`, `select`), and values. A `size` option picks a **size system**; its values are chosen from that system (checkbox list, system order). Other roles: free value rows with optional swatch |
| Colour | Use a `color` option only for a product with **no** colourway siblings (ADR-0014). If a style id is set, the editor refuses a `color` option with an explanation |
| Generation | Variants = cartesian product of option values, generated on demand ("Generate variants" button shows how many will be created; cap 100). Existing variants keep their id, SKU, price and stock; removed combinations are listed for confirmation before deletion; a variant that appears on any order cannot be deleted, only disabled |
| Custom size value | For made-to-order with a custom-size form, the size option gets a special value "Custom" (`kind: 'custom'`) with no counted stock |

Variant table (virtualized above 100 rows, DOC-05 §2):

| Column | Control | Rules |
|---|---|---|
| Variant | Read-only label ("M", "M / Lawn") | |
| SKU | `Input` | Required, unique across the catalog (checked on blur via `admin.products.checkSku`), ≤ 40, upper-cased |
| Price | `MoneyInput` | Required, > 0 |
| Compare-at | `MoneyInput` | Empty or > price |
| Stock status | `NativeSelect`: counted / made to order / preorder | "Counted" shows the quantity; the API derives `in_stock`/`low_stock`/`sold_out` from it |
| On hand | Read-only number + **Adjust** button | §7.1 |
| Reserved | Read-only | Units held by open orders (ADR-0020) |
| Max per order | `NumberInput` | 1–99, default 10 |
| Enabled | `Switch` | Disabled variants are not sold or shown |

Row helpers: "Apply price to all", "Apply compare-at to all", "SKU pattern" (prefix + option codes).

### 7.1 Stock adjustment

Stock is **not** a form field saved with the product (that would overwrite sales made while the editor was open). "Adjust" opens a `Dialog`:

| Field | Rule |
|---|---|
| Mode | "Add" / "Remove" / "Set to" |
| Quantity | Integer ≥ 0; "Remove" and "Set to" cannot go below `reserved` (error names the open orders count) |
| Reason | Required: restock, count correction, damaged, returned to stock, other (+ note) |

It calls `admin.inventory.adjust` (needs `inventory:adjust`), which applies a **delta** in a transaction and writes an inventory movement (DOC-09). The table row updates from the response. A new product's first quantities are entered inline and sent as initial movements on create.

## 8. Status and publishing

| Status | Meaning | Who |
|---|---|---|
| `draft` | Not on the storefront | `products:write` |
| `scheduled` | Becomes `active` at "Publish at" (job, ADR-0009) | `products:publish` |
| `active` | Live | `products:publish` |
| `archived` | Hidden; URL returns 404; kept for order history | `products:publish` |

Publish checks ("Checks" card, live as the form changes; all must pass to save as `active` or `scheduled`):

1. Title, handle, primary category, kind present.
2. At least one image, every image has alt text.
3. At least one enabled variant; every enabled variant has SKU and price.
4. `unstitched`: at least one component. `made_to_order`: lead time set. `bundle`: at least 2 children, all active.
5. Compare-at prices are higher than prices.
6. Attributes marked required in the category schema are filled.

A draft can be saved with any of these failing; the failures are listed with links that focus the field.

## 9. Saving, concurrency and other actions

| Topic | Rule |
|---|---|
| Save | `admin.products.update` with the whole form and the product's `version`. On success: toast "Product saved", form reset to the response, `productKeys.all` invalidated |
| Stale write | If someone else saved meanwhile the API returns `409 stale_write`; a `Dialog` offers "Reload their version" or "Overwrite with mine" (the latter needs `products:publish`) |
| Validation errors | Field issues map to fields; the first one is focused; the section list marks sections with errors |
| Unsaved changes | Sticky bar + navigation guard (DOC-04c §3) |
| Create | `/products/new` shows the same form with kind and category first; Save creates and redirects to `/products/:id` |
| Duplicate | Copies everything except handle (gets `-copy`), SKUs (get the suffix `-COPY`, since SKUs must stay unique), stock (0) and status (draft) |
| Delete | Allowed only for products with no order lines; otherwise the action is replaced by Archive with an explanation. `ConfirmDialog` names the product |
| View | Opens `/p/:handle` on the storefront; for non-active products opens a preview URL with a signed, short-lived token (`admin.products.previewLink`) |
| Activity | A collapsed "History" card lists this product's audit entries (DOC-07.13) |

## 10. Import and export

| Action | Detail |
|---|---|
| Export CSV | One row per variant: product id, handle, title, status, kind, category, option values, SKU, price (rupees with 2 decimals), compare-at, on hand, reserved. Respects current filters. Runs as a job for more than 1,000 rows and delivers a download link toast |
| Import CSV | For **price and stock updates of existing SKUs** in v1: columns `sku`, `price`, `compare_at`, `stock_set`. Upload → preview table with per-row validation → confirm. Stock changes become "count correction" movements. Creating products by CSV is not in v1 |

## 11. Rules

**Always:** edit money through `MoneyInput`; change stock only through adjustments; send the `version` with every save; show why a product cannot be published.
**Never:** save stock as part of the product form; let a `color` option coexist with a style id; delete a variant or product that has order lines; store rupee floats.
**Common mistakes:** regenerating variants and losing SKUs; uploading through the API server instead of presigned storage; one giant re-render per keystroke from `watch()` (DOC-05 §3).

## 12. Acceptance checklist

- [x] One test product per kind can be created, published and viewed on the storefront with its kind-specific blocks (DOC-06.4 §5). (Editor side done in M3-03: every kind has its section. Storefront half: the page shows each kind's blocks (M5-04, DOC-06.4 §12); created and published in the editor then viewed on the storefront was done by hand for the seeded demo products only.) (E2E-09: one product of each of five kinds (stitched, unstitched, made to order, footwear, accessory) is made in the editor and read on the storefront; bundle, home and beauty are not covered.)
- [x] Adding a size value generates only the new variants and keeps existing SKUs, prices and stock. (`variants.test.js`, `variants-editor.test.jsx`)
- [x] Two editors saving the same product: the second gets the stale-write dialog. (Reload their version; Overwrite with mine only with `products:publish`.)
- [x] Selling a unit while the editor is open, then saving, does not change stock. (By construction: stock is not in the saved document, `toBody` drops it; adjustments go through their own dialog.)
- [x] "Remove 5" with 3 unreserved units is rejected with the reserved explanation. (Dialog shows the server's `stock_below_reserved`.)
- [x] Publishing with a missing alt text is blocked and the check links to the image. (The Checks card lists the server's checks with a Fix link that focuses the field; the save is refused by the API.)
- [ ] A 200-row variant table scrolls smoothly (virtualized) and remains keyboard-navigable. **Dropped**: a product has at most 100 variants and the table is plain rows (same decision as DOC-07.14 section 2). **Decided: dropped (a product has at most 100 variants).**
- [x] An uploaded `.jpg` that is really HTML is rejected at `confirm`. (Server: M1-05. The editor shows the server's reason under the file.)

## 13. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.3-1 | `version` field on products for optimistic locking | Added in DOC-09 | DOC-09 catalog |
| Q-07.3-2 | Product creation by CSV | Not in v1 | More than 200 products to enter at once |
| Q-07.3-3 | Cost price / margin | Not in v1 | DOC-07.2 Q-07.2-4 |
| Q-07.3-4 | Markdown editor | Plain textarea + preview (no rich-text library) | Staff ask for a toolbar |
| Q-07.3-5 | `media` vs `images` in the contract | One gallery in the admin; DOC-09 merges the two contract fields | DOC-09 |

## 14. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-02 | Phase 7 consistency review: kind and badge values match DOC-09.0 §5 |
| 2026-10-13 | M7-01: the list has the bulk actions Publish, Move to draft and Archive for people with `products:publish` (select the page; "select all that match" is off because the call takes ids, at most 100). The failures dialog names the products that could not go live |
| 2026-10-05 | M3-03 built (`features/products`): list with thumbnails, category filter and row actions; editor with basics, media, type-specific sections, options and variants, attributes, details, colourway, related products, search and address, status, organisation and live publish checks; save with version, stale-write dialog, unsaved guard, duplicate, delete, archive, preview link; stock adjustment dialog. **Not built**: bulk actions, CSV export and import (endpoints `admin.products.bulk`, `.export`, `.importPreview`, `.importApply` do not exist), Urdu fields, drag reordering of pictures (buttons instead), per-file upload progress bar, video, the `hasIssues` and collection list filters, the History card, and a tree Combobox for categories (a native select with paths). Collections are edited on the collection screens (M3-04) |

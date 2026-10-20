# 07.4 — Admin: Catalog Structure

| Field | Value |
|---|---|
| ID | DOC-07.4 |
| Title | Categories, collections, attributes, size systems, size charts, custom-size forms |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.3, DOC-07.14, DOC-06.3, DOC-06.9 |
| Decisions used | ADR-0010, ADR-0014, ADR-0018 |

## 1. Purpose and scope

**Governs:** the four catalog-structure screens: `/categories`, `/collections`, `/attributes`, `/sizes`.
**Does not govern:** products (DOC-07.3); how facets are queried (ADR-0010, DOC-10 catalog); tables (DOC-09 catalog).

All four need `catalog:read` to view, `catalog:write` to create/edit, `catalog:delete` to delete. Each edit happens in a `Drawer side="end"` with its own Save (open state in the URL: `?edit=<id>` or `?new=1`), except collections, which have a page.

## 2. Categories (`/categories`)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Categories                                              [+ New category]│
├────────────────────────────────────────────────────────────────────────┤
│ ▾ Women                    /c/women            124 products   ↑ ↓  ⋯  │
│     ▾ Unstitched           /c/unstitched        86            ↑ ↓  ⋯  │
│         Lawn               /c/lawn              52            ↑ ↓  ⋯  │
│     ▸ Stitched             /c/stitched          38            ↑ ↓  ⋯  │
│ ▸ Footwear                 /c/footwear          22            ↑ ↓  ⋯  │
└────────────────────────────────────────────────────────────────────────┘
```

| Field | Control | Rules |
|---|---|---|
| Name | `Input` | Required, ≤ 60 (+ Urdu field when `ur` is supported) |
| Handle | `Input` | Required, unique among categories, slug pattern; change creates a redirect |
| Parent | `Combobox` (tree paths) | None = top level. Max depth 3. A category cannot be its own ancestor |
| Description | `Textarea` | ≤ 600; shown as the listing intro (DOC-06.3 §2) |
| Image | `ImageUpload` (1) | Used by home category tiles (DOC-06.2); alt required |
| Filters shown | Ordered multi-select of attributes (`filterSchema`) | Only `filterable` attributes; order = facet order on the storefront. Empty = inherit the parent's |
| Indexable filters | Subset of the above (`seoIndexable`) | The single-value filter pages search engines may index (DOC-06.9 §5) |
| Required attributes | Subset of the above | Must be filled to publish a product in this category (DOC-07.3 §8) |
| SEO title, description | `Input`, `Textarea` | ≤ 60, ≤ 160 |
| Visible | `Switch` | Hidden categories are absent from menus, tiles and the sitemap; their URL returns 404 |

| Behaviour | Rule |
|---|---|
| Tree | Rendered as a `role="tree"`; rows expand/collapse; product count includes descendants and links to `/products?category=<id>` |
| Reorder | Up/down buttons per row (within siblings), saved immediately and optimistically (DOC-05 §9). No drag-and-drop in v1 |
| Move | Change the parent in the drawer |
| Delete | Blocked while the category has child categories or is the **primary** category of any product; the dialog says how many and links to them. Otherwise products merely tagged with it lose the tag |
| Storefront effect | Saving purges the `categories` cache tag (DOC-08) |

### 2.1 Subcategories (`/subcategories`, added 2026-10-19)

A flat table of every category that has a parent: **Name** (with its address), **Parent** (the whole trail, "Women › Unstitched"), **Products**, **On the website** (and why not), actions. Search by name or handle; filter by parent (a parent also matches what is below it) and by shown / not shown. "New subcategory" opens the category drawer under the chosen parent; the row menu has Edit, Add a subcategory and Delete; checkboxes and "Delete selected" follow plan/07-admin/14 §5.4. It reads the same list as the tree, so the two cannot disagree.

## 3. Collections (`/collections`, `/collections/:id`)

A collection is a hand-picked, ordered set of products with its own page `/collections/:handle` (GLOSSARY "Drop").

List columns: Title, Handle, Products (count), Status, Featured, Updated. Filters: `q`, `status`.

| Field | Control | Rules |
|---|---|---|
| Title | `Input` | Required, ≤ 80 |
| Handle | `Input` | Required, unique among collections |
| Description | `Textarea` | ≤ 600 |
| Image | `ImageUpload` (1) | Collections row on the home page |
| Status | `NativeSelect`: draft / active | Draft URL returns 404 |
| Featured | `Switch` | Shown on the home page (max 3 featured; the fourth asks which to replace) |
| Publish window | Start and end date-time (optional) | Outside the window the collection behaves as draft (a "drop") |
| SEO title, description | | |
| Products | Async product search to add; table of members with thumbnail, title, status, stock; up/down/"move to top" and Remove; bulk remove | Order here is the `featured` sort on the collection page. Membership is stored once, on the collection (the current duplicate `product.collectionIds` ↔ `collection.productIds` is removed, see DOC-09) |

Delete: allowed any time (products are untouched), with `ConfirmDialog`.

## 4. Attributes (`/attributes`)

Attributes describe products (fabric, technique, pieces, occasion, season, colour family) and drive storefront filters.

List columns: Label, Key, Type, Display, Values (count), Filterable, Used by (product count).

| Field | Control | Rules |
|---|---|---|
| Label | `Input` | Required (+ Urdu) |
| Key | `Input` | Required, unique, `^[a-z][a-z0-9_]*$`, ≤ 30. **Immutable after creation** (it is the `attr.<key>` URL parameter) |
| Type | `NativeSelect`: enum, number, boolean, color | Immutable after creation |
| Filter display | checkbox, swatch, buttons, range | `range` only for `number`; `swatch` only for `color` |
| Filterable | `Switch` | Off = descriptive only (shown on the PDP, not as a facet) |
| Group | `Input` with suggestions | Groups attributes on the PDP details ("Fabric", "Occasion") |
| Values (enum/color) | Repeating rows: label (+ Urdu), swatch for colour; up/down reorder | A value's id never changes; renaming the label is safe. Deleting a value used by products is blocked with the count; "Merge into…" moves products to another value |

Delete attribute: blocked while any product uses it or any category lists it in its filters; the dialog shows both counts.

## 5. Sizes (`/sizes`): three tabs

Tab state in the URL (`?tab=systems|charts|forms`).

### 5.1 Size systems

An ordered list of size labels a product's size option draws from (e.g. "Women's stitched": XS, S, M, L, XL; "Footwear EU": 36–41).

| Field | Rules |
|---|---|
| Name | Required, unique |
| Values | Repeating rows: label (≤ 10), order by up/down. Removing a value used by any variant is blocked with the count |

### 5.2 Size charts

Measurement tables shown in the storefront size guide (DOC-06.4 §4, DOC-06.8 §4).

| Field | Rules |
|---|---|
| Title | Required |
| Size system | Optional link; pre-fills the row labels |
| Unit | in / cm. The chart is entered in one unit; the storefront converts for display (1 in = 2.54 cm, rounded to 0.5) |
| Tables | 1–4 per chart. Each: title ("Kameez", "Trouser"), columns (measurement names: bust, waist, hip, length …), rows (one per size) with numeric cells. Spreadsheet-like grid: arrow keys move between cells, `Enter` moves down, paste from a spreadsheet fills a block |
| How-to-measure image | Optional `ImageUpload` with alt |
| Notes | ≤ 400 |
| Used by | Read-only count of products, linking to the filtered product list |

Delete chart: **blocked while any product uses it** (as built: the API answers `in_use` with the product count; the earlier idea of letting products lose the link was dropped, like for custom-size forms).

### 5.3 Custom-size forms

The measurement forms made-to-order products ask customers to fill (contract `FormSchema`, DOC-06.4 §7).

| Field | Rules |
|---|---|
| Title | Required |
| Fields | Repeating rows: key (immutable after first save), label (+ Urdu), type (number, select, text, textarea, checkbox), required, unit (in/cm), min, max, step, options (for select), help text. Reorder with up/down |
| Allow notes | Checkbox: adds a free-text "Anything else?" field |
| Preview | Live preview of the form as the customer sees it |

Changing a form never changes measurements already stored on orders (order lines keep their own copy). Deleting a form in use is blocked with the product count.

The checkout-fields form (`StoreConfig.checkout.fields`) is edited in settings (DOC-07.11), not here.

## 6. Rules

**Always:** show where an item is used before allowing its deletion; keep keys and handles stable; purge the storefront cache tag after a save.
**Never:** allow free-text attribute values on products; let a category tree exceed depth 3; change an attribute key or type after creation; cascade-delete products from any of these screens.
**Common mistakes:** storing collection membership in two places; deleting a size value that live variants use; reordering by renaming.

## 7. Acceptance checklist

- [x] Deleting a category that is some product's primary category is blocked and shows the count. (`categories.test.jsx`)
- [ ] Reordering a category updates the storefront menu fallback order after the cache purge. (The screen saves the order at once and undoes it if the server refuses; the storefront side waits for M5.) **Open: the storefront side exists (M5); no journey reorders a category and reads the menu.**
- [ ] Setting a category's "Filters shown" changes the facets on its storefront listing, in the same order. (The drawer saves the ordered list with Indexable and Required flags; the facets are served by the API from M1-12; the storefront side waits for M5-03.) **Open: same.**
- [x] An attribute key cannot be edited after creation (field read-only, API rejects). (Type is fixed too.)
- [x] Pasting a 5 × 4 block from a spreadsheet fills a size-chart table. (`pasteBlock`, and a paste into the grid.)
- [x] A fourth featured collection triggers the replace prompt. (The API names the three; the dialog sends `replaceFeaturedId`.)
- [x] Every drawer here restores from its URL after a reload. (`?edit=` and `?new=`; the sizes tab is `?tab=`.)

## 8. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.4-1 | New contract fields: category `description`, `seo`, `visible`, `sortOrder`, `seoIndexable`, `requiredAttributes`; collection `image`, `featured`, window, `seo`; attribute `group` usage | Added in DOC-09 catalog | DOC-09 |
| Q-07.4-2 | Rule-based (automatic) collections | Not in v1; manual only | Owner wants "all sale items" style collections beyond `/sale` |
| Q-07.4-3 | Drag-and-drop reordering | Buttons only (accessible, no library) | Staff reorder long lists often |

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-05 | M3-04 built (`features/catalog`): categories tree (expand, reorder, drawer with filters, image, SEO, delete reasons), attributes (drawer, merge, fixed key and type), sizes (systems, charts with a spreadsheet-like grid and paste, custom-size forms with preview), collections (list as `DataTable`, editor page with ordered members, featured-replace prompt). The lists that are not paged (categories, attributes, size lists) are plain tables, not `DataTable`. **Not built**: Urdu fields, a tree Combobox for the parent (native select with paths), bulk remove of collection members, "used by" links that filter the product list by chart or form, and a stale-write dialog for collections (a message says to reload) |

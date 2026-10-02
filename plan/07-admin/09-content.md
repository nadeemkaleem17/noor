# 07.9 — Admin: Content

| Field | Value |
|---|---|
| ID | DOC-07.9 |
| Title | Home page content, CMS pages, menus |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-06.1 §3, DOC-06.2, DOC-06.8 |
| Decisions used | ADR-0006, ADR-0011, ADR-0018 |

## 1. Purpose and scope

**Governs:** `/content/home`, `/content/pages`, `/content/pages/:id`, `/content/menus`.
**Does not govern:** how the storefront renders this content (DOC-06.1, 06.2, 06.8); theme (DOC-07.11).

Needs `content:read`; edits need `content:write`; deleting a page or menu needs `content:delete`. Saving any of these purges the matching storefront cache tag (DOC-08).

## 2. Home page (`/content/home`)

One form, sections as cards, one Save. A "Preview storefront" link opens `/` in a new tab.

| Card | Fields | Rules |
|---|---|---|
| Announcement bar | Text (≤ 100), optional link | Empty text hides the bar |
| Notices | Repeating rows: text, link, severity (info / promo / notice), start, end | Rotated on the storefront within their window (DOC-06.1 §3). Max 5 |
| Hero slides | Repeating cards: image (`ImageUpload`, required, ≥ 1600 px wide), image alt, heading (required, ≤ 60), subheading (≤ 90), button text (≤ 24), button link; up/down reorder | 0–6 slides. A link without button text (or the reverse) is an error. Guidance text: "Keep faces and products centred: the image is cropped to 4:5 on phones" with a side-by-side 4:5 and 16:7 crop preview |
| Promo band | Enabled, eyebrow, heading, text, button text, button link | Hidden on the storefront when disabled or heading empty |
| Editorial band | Enabled, image + alt, eyebrow, heading, text, button text, button link | Same |
| Footer | About text (≤ 300) | Phone, email, address and socials come from store settings (DOC-07.11), not from here |

Link fields use one `LinkField` component: a `Combobox` offering internal targets (categories, collections, products, CMS pages, `/new`, `/sale`) and accepting a typed URL; it validates with the same rule as the storefront (`/…`, `https://…`, `mailto:`, `tel:`, `https://wa.me/…`) so an invalid link is rejected here instead of silently hidden there.

## 3. CMS pages

### 3.1 List (`/content/pages`)

Columns: Title, Slug (`/pages/<slug>`), Status (draft / active), Updated, Updated by. Filters: `q`, `status`. Required pages (DOC-06.8 §3) carry a lock icon and have no Delete action.

### 3.2 Editor (`/content/pages/:id`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Pages › Shipping & returns                    [View] [Save]            │
├──────────────────────────────────────────────┬───────────────────────────┤
│ Title   [Shipping & returns            ]     │ Status  active ▾          │
│ Body    [Write] [Preview]                    │ Slug    shipping-returns  │
│ ┌──────────────────────────────────────────┐ │ SEO title                 │
│ │ ## Delivery                              │ │ SEO description           │
│ │ We deliver across Pakistan in …          │ │ Insert                    │
│ │ Orders over {{shipping.freeAbove}} …     │ │ {{store.phone}} …         │
│ └──────────────────────────────────────────┘ │ [Insert image]            │
└──────────────────────────────────────────────┴───────────────────────────┘
```

| Field | Rules |
|---|---|
| Title | Required, ≤ 100 (+ Urdu when supported) |
| Slug | Required, unique, slug pattern; read-only for required pages; changing it creates a redirect |
| Status | draft / active. Required pages cannot be set to draft |
| Body | Markdown `Textarea` (monospace, auto-grow). "Preview" renders with **the same renderer and allow-list as the storefront** (shared from `@noor/ui/markdown`), so what is previewed is what ships. ≤ 50,000 characters |
| Insert token | Buttons inserting `{{store.phone}}`, `{{store.email}}`, `{{store.whatsapp}}`, `{{store.address}}`, `{{shipping.freeAbove}}`, `{{shipping.fee}}`, `{{returns.days}}` at the cursor; the preview shows them resolved |
| Insert image | Uploads through the media pipeline and inserts `![alt](url "WxH")`; alt is asked for in the dialog and required |
| Formatting help | A collapsible cheat sheet of the allowed Markdown (headings, lists, bold, links, tables, images) |
| SEO title, description | ≤ 60, ≤ 160, with preview |

Raw HTML typed into the body is shown as text in the preview (it is not rendered on the storefront); a hint says so. Unsaved-changes guard applies.

## 4. Menus (`/content/menus`)

Two fixed menus: **Main** (`main`) and **Footer** (`footer`). No others can be created in v1 (the storefront reads only these two).

```
┌──────────────────────────────────────────────────────────────┐
│ Menus     [Main] [Footer]                           [Save]   │
├──────────────────────────────────────────────────────────────┤
│ ≡ New            → /new                         ↑ ↓  ✎  ✕   │
│ ≡ Women          → /c/women                     ↑ ↓  ✎  ✕   │
│     Unstitched   → /c/unstitched                ↑ ↓  ✎  ✕   │
│     Stitched     → /c/stitched                  ↑ ↓  ✎  ✕   │
│     [+ Add sub-link]                                         │
│ ≡ Sale           → /sale                        ↑ ↓  ✎  ✕   │
│ [+ Add link]                                                 │
└──────────────────────────────────────────────────────────────┘
```

| Rule | Detail |
|---|---|
| Item | Label (required, ≤ 30, + Urdu), link (`LinkField`) |
| Depth | Main: 2 levels. Footer: 1 level |
| Limits | Main: 8 top-level, 12 children each. Footer: 10 |
| Reorder | Up/down buttons; "Indent/Outdent" moves between levels |
| Broken links | An item pointing to a category, collection, product or page that is hidden, draft or deleted is marked with a `warning` badge "Target not live" (checked by the API on load) |
| Empty main menu | A notice explains the storefront falls back to "New, top categories, Sale" (DOC-06.1 §3) |
| Save | Whole menu in one request with `version` (stale-write dialog as in DOC-07.3 §9) |

## 5. Rules

**Always:** preview with the shared storefront renderer; validate links at entry; require alt text for every image.
**Never:** accept raw HTML as formatting; let a required page be deleted or unpublished; duplicate contact details into content (use tokens).
**Common mistakes:** text baked into a hero image; a menu item to a draft collection; typing a delivery fee instead of the token.

## 6. Acceptance checklist

- [ ] The Markdown preview and the storefront page render identical HTML for the same body (shared component, snapshot test).
- [ ] A hero slide with a link but no button text cannot be saved.
- [ ] `javascript:alert(1)` is rejected by `LinkField`.
- [ ] Changing the store phone (DOC-07.11) changes the resolved token in the page preview.
- [ ] A menu item whose category was hidden shows "Target not live".
- [ ] Required pages have no Delete and no Draft option.
- [ ] Saving the home form updates the storefront home within the cache window (tag purge verified in an integration test).

## 7. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.9-1 | Moving `SiteSettings` notices vs `StoreConfig.notices` | One list, edited here; DOC-09 decides where it is stored | DOC-09 |
| Q-07.9-2 | Page templates (sections/blocks) | Not in v1 | DOC-06.2 trigger |
| Q-07.9-3 | Scheduling home content (hero for a future drop) | Not in v1 (notices and collections have windows; hero does not) | Owner asks before a seasonal launch |
| Q-07.9-4 | Rich-text editor | Markdown textarea + preview | Staff feedback |

## 8. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |

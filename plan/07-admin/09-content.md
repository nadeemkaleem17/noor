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

Link fields use one component, `LinkInput` (`components/link-input.jsx`, built in M3-05 as a text field with the browser's own suggestion list instead of a `Combobox`; the contract's link rule runs in each form's resolver): it offers internal targets (categories, collections, products, CMS pages, `/new`, `/sale`) and accepting a typed URL; it validates with the same rule as the storefront (`/…`, `https://…`, `mailto:`, `tel:`, `https://wa.me/…`) so an invalid link is rejected here instead of silently hidden there.

### 2.1 Home page sections (added 2026-10-20, plan/17 items 2 and 3)

A card **Home page sections** lists the parts below the pictures in the order the shop shows them: Category pictures, New in, Collections, Category blocks, Promo band, Bestsellers, Editorial band. Each has up and down buttons. Category pictures, New in, Collections, Category blocks and Bestsellers also have a **Show** switch and a size (categories 2 to 12, products 4 to 12, collections 1 to 6, blocks 1 to 6); all but Category blocks have a **Heading** (empty = the usual words). The Promo and Editorial bands keep their own Show switch in their cards; here they are only placed. Stored as `layout` in the home document; a section left out of `order` follows in the default order; the first load is the home page as it was before. The shop reads `layout` from `content.getHome` (`routes/home.jsx`) and fetches only what is shown. Not built: a draft that is published later, other layouts for the category pictures (grid, list, scroll), a per-category "show on the home page" switch, and the definition of "new" by days (New in is the newest N products).

### 2.2 Notices (`/content/notices`, added 2026-10-20, plan/17 item 4)

A screen of its own for the notices that used to be a card of the Home page form (which now only links to it). A table: the notice, **where** (strip above the header, popup when the shop opens, card at the side), its **colour**, **when** (always, or from / to), and its **state** (Live, Scheduled, Ended, Off). Row menu: Edit, Switch on / off, Move up / down, Delete; checkboxes and "Delete selected" ask first and name the notices. "New notice" and Edit open a side panel: where, headline (the one line of a strip), title and details (popup and side card), button text with its link, a colour from five readable pairs (brand, dark, soft grey, green, amber; no free colours, so the words are always readable), how often one visitor sees a popup (every visit, once a day, once ever), start and end, On, and a preview. Up to 10. Saving takes the latest home page and replaces only `notices`, so nothing else on it can be overwritten; the home form still carries the list through unchanged.

The shop (`features/layout/notice-popup.jsx`, `notice-side.jsx`, `announcement.jsx`): the strip rotates as before, in its colour; the popup is a real dialog drawn after 1.5 s in the browser only (a page without scripts is not covered) and is remembered in `localStorage` (`nc_popups`) for its frequency; the side card sits at the corner (along the bottom on a phone), is closed for the visit through the same cookie as the strip, and does not take the focus. None is drawn on the checkout. Not built: Urdu text for the new fields, per-page placement, images in a notice.

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

- [ ] The Markdown preview and the storefront page render identical HTML for the same body (shared component, snapshot test). (The editor previews with `@noor/ui/markdown` after the server resolved the tokens; the storefront page and the snapshot test come with M5.) **Open: both use `@noor/ui/markdown`; no snapshot test.**
- [x] A hero slide with a link but no button text cannot be saved.
- [x] `javascript:alert(1)` is rejected by `LinkInput` (home form and menus).
- [ ] Changing the store phone (DOC-07.11) changes the resolved token in the page preview. (The preview calls `admin.pages.preview`, which resolves from the stored settings; seen with the seeded phone. Waits for the store settings screen, M3-06, to change it.) **Open: seen by hand only.**
- [x] A menu item whose category was hidden shows "Target not live". (From the API's `targetLive`.)
- [x] Required pages have no Delete and no Draft option. (Seen on the real contact page.)
- [ ] Saving the home form updates the storefront home within the cache window (tag purge verified in an integration test). (Server side: M1-06. The form saves the whole document with its version.) **Open: no journey edits the home form; E2E-13 proves the same path for the theme (the shop reads its settings within 30 s).**

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
| 2026-10-05 | M3-05 built (`features/content`): home form (announcement, notices, hero slides with 4:5 and 16:7 crop preview, promo and editorial bands, footer), pages list and editor (Write/Preview through the server, token and image insertion, locked pages), menus (two menus, indent and outdent, limits, "Target not live"). Not built: Urdu fields, a `Combobox` for links, drag reordering, a hard 1600 px minimum for hero pictures (a warning below it; 800 px is the floor for all pictures), a stale dialog that reloads the home form field by field (it reloads the whole document) |

# 06.13 — Navigation and categories: how every admin category reaches the navbar, the home page, the category pages and the footer

| Field | Value |
|---|---|
| ID | DOC-06.13 |
| Title | Category-driven navigation, home composition and category pages |
| Status | Draft, written 2026-10-16 at the owner's request ("all admin categories, researched"), for approval with DOC-06.11 |
| Owner | Tech lead |
| Depends on | DOC-06.1 (shell), DOC-06.2 (home), DOC-06.3 (listings), DOC-06.11 (v2 plan), DOC-06.12 (coverage), DOC-07.4 (catalog admin) |
| Replaces | The navigation rows of DOC-06.1 §3 and the "Category tiles" section of DOC-06.2 §2 once approved |

## 1. The categories the admin holds today

Read from the development database on 2026-10-16 (the demo shop; the owner's real categories replace them, and **everything below is data-driven, so any tree works**).

```
Women                      (no products of its own; lists its children's)
├── Unstitched             filters: Fabric, Pieces
├── Stitched               filters: Fabric, Pieces, Occasion
└── Bridal & Formals       filters: Fabric, Occasion
Men                        filters: Fabric
Kids                       filters: Fabric
Footwear                   filters: Material
Accessories                filters: Material
Test                       (empty; left over from manual testing: hide or delete before launch)
Collections (curated, not categories): New in · Sale · Eid edit
Attributes (shop-wide): Fabric · Pieces · Occasion · Material · Colour · Size
```

A category carries: name, handle, parent, picture, description, visible, its filters in order, SEO, sort order, product count. It does **not** yet say "show in the menu" or "feature on the home page"; §8 adds both.

## 2. What the research says to do

Sources and confidence are in DOC-06.11 §3; the ones that decide this document:

| Question | Finding | Decision here |
|---|---|---|
| How should a big tree sit in the main bar? | Hover drop-downs are the main navigation at 88% of top US shops and need care in detail: clickable parents, no hover flicker ([Baymard](https://baymard.com/homepage-and-category-usability/benchmark/page-types/drop-down-menu)); the accessible pattern is a disclosure button, Escape to close ([W3C APG](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)); open after a short intent delay (a secondary source attributes about 0.5 s to the Nielsen Norman Group, not verified at the source), keep panels to simple, scannable groups | Mega panel for any category with children; 150 to 300 ms intent delay; click and keyboard work the same; no complex widgets in the panel |
| Gender first or type first? | No controlled study found; practitioners favour a **hybrid**: gender-style top level for fashion, and the same things also reachable as filters; "if you would make a collection for it, make it a filter too" ([practitioner guide](https://ecommercebadassery.com/how-to-set-up-your-ecommerce-navigation-menu-and-collection-filters/)) | Keep the owner's tree (Women, Men, Kids first, then Footwear, Accessories); attributes (Fabric, Occasion, Material) appear as "Shop by" inside the panel and as filters |
| What should a parent category page be? | Baymard calls it an *intermediary category page*: it shows sub-categories **with thumbnails**, placed where they are easy to find, and guides to filters or promoted products; 32% of shops have no such page ([guideline 309](https://baymard.com/guidelines/309-subcategory-thumbnails-on-intermediary-category-pages), [308](https://baymard.com/guidelines/308-subcategory-placement-on-intermediary-category-pages)); fashion pages are often editorial hybrids: hero, sub-category tiles, curated picks, then the grid ([Baymard category page learn](https://baymard.com/learn/ecommerce-category-page)) | `/c/women` becomes a landing page, `/c/stitched` a leaf listing |
| Mobile menu with three levels | Accordions or drill-down work; keep parent pages reachable while allowing depth (Baymard mobile); 44 px targets; click, not hover ([Smashing](https://www.smashingmagazine.com/2022/11/navigation-design-mobile-ux)) | Drill-down with an "All <parent>" first row |
| Naming | Name categories as customers search; reach products in few clicks | Labels come from the admin; the usability test (DOC-06.11 §8.4) checks the words |
| What do Pakistani leaders do? | Khaadi: mega menu with columns per line and garment type, round collection chips on listings, grid-density switch; Sapphire and Outfitters: gender tabs and a drawer with the whole tree (DOC-06.11 §3.3) | Same families of ideas, driven by our own data |

## 3. The rule that makes it complete

**Coverage invariant (a test, not a hope):** for the data in the shop, every *visible* category with at least one active product is reachable from the header in at most **two interactions** (open a panel, click), every *top-level* category appears in the navbar in **one**, on the home page, in the footer and on `/categories`. A category that is hidden or empty appears nowhere (so "Test" never shows). New categories need no code change.

## 4. The navbar

### 4.1 Where the items come from
Automatic by default: the category tree plus the collections, in this order, with the order of the admin (`sortOrder`) inside each group:

```
NEW IN   |  Women ▾  |  Men ▾  |  Kids ▾  |  Footwear ▾  |  Accessories ▾  |  Collections ▾  |  SALE
```

- `New in` and `Sale` are the collections of those names, pinned first and last (Sale in the sale colour). If a collection does not exist the item is not drawn.
- Every visible top-level category with products is an item. At most **8** items fit; more go into a `More ▾` item.
- `Collections ▾` lists the featured collections (Eid edit and any later ones) and "All collections".
- Staff can switch the navbar to **Custom** in Settings: then menu `main` (today's screen) is used exactly as written. Automatic is the default and the seed no longer writes a menu.

### 4.2 What each item opens

| Item | Panel |
|---|---|
| Category **with children** (Women) | **Mega panel**: one column per child (Stitched, Unstitched, Bridal & Formals), each a clickable heading with up to 5 links below it (grandchildren, or the child's most used first filter values, e.g. Stitched: Cotton, Lawn, Chiffon, Silk, Co-ord); a last column "Shop by" with the parent's filters as links (Occasion: Casual, Formal, Bridal, Festive; Pieces: 1, 2, 3); a picture tile (the category's picture or the featured collection); a footer link "View all Women (N)" |
| Category **without children** (Men, Kids, Footwear, Accessories) | **Simple panel**, shown only if the category has filters: one or two columns of "Shop by <filter>" (Footwear: Leather, Suede, Fabric; Men: Cotton, Lawn, Khaddar), a picture tile, "View all". With no filters the item is a plain link |
| Collections | A list of featured collections with a small picture each, and "All collections" |
| New in, Sale | Plain links |

Rules: parents are **links as well as triggers** (Baymard); open on hover after 150 ms, on click, Enter or Space; Escape closes and returns focus; leaving the panel with the pointer or focus closes it after 200 ms; panels are in the HTML so the links work without JavaScript; the filter links are plain query links (`/c/women?occasion=formal`).

### 4.3 The utility row and icons
Above the bar: the announcement (exists) with **Track order** and **WhatsApp** on the right. In the bar, right side: search (field on wide screens), wishlist, bag with count. Honours the Appearance settings that are dead today: header layout (left or centre) and "keep at the top" (DOC-06.12).

### 4.4 Phone
Top bar: menu button, logo, search, bag. The menu is a **drill-down drawer**: a search field, then rows with a small picture (Women, Men, Kids, Footwear, Accessories, Collections, New in, Sale, then Track order, WhatsApp); a row with children opens the next level whose first row is "All Women" (so the parent page stays reachable); at most three levels; back button always visible. Optional bottom bar (Home, Shop, Search, Saved, Bag) as an owner option; "Shop" opens the same drawer.

## 5. Home page: every top category appears at least twice

Order of sections (a section with no data is not drawn):

1. **Hero** campaign (exists; readable).
2. **Shop by category**: a row of **round pictures with names**, one per visible top-level category (Women, Men, Kids, Footwear, Accessories), then Collections; scrolls sideways on a phone. Picture = the category picture, else the picture of its best-selling product, so it is never empty.
3. **New in** with **tabs by top category** (All, Women, Men, Kids, Footwear, Accessories): 8 products each, "View all" link per tab.
4. **Featured collections**: large tiles (Eid edit and others).
5. **Shop by occasion**: tiles from the Occasion filter (Casual, Formal, Bridal, Festive), each a link to the filtered listing. Shown only if the shop has that filter.
6. **Category spotlights**: one two-column block per top category that was not the lead of an earlier section (Footwear, Accessories, Men, Kids): picture, name, one line, "Shop <name>", and four product thumbnails; alternates left and right.
7. **Bestsellers** with the same tabs as New in.
8. Promo band (exists), **customer reviews highlight**, editorial band (exists), trust strip (exists).

Coverage rule: sections 2 and 6 together mean each visible top category has a picture entry and a block on the home page; the test counts them.

## 6. Category pages

| Page | When | Content |
|---|---|---|
| **Landing** (e.g. `/c/women`) | the category has children | Breadcrumb; a hero band (picture, name, description); **sub-category tiles with pictures and counts**; "Shop by occasion/fabric" chips; two curated rails ("New in Women", "Bestsellers in Women"); then "All Women" with filters and sort, as a normal listing |
| **Leaf** (e.g. `/c/stitched`) | no children | Breadcrumb; title, description, product count; **round chips** for sibling categories and for the first filter's popular values (Khaadi pattern); sticky filter and sort bar; grid with density switch; load more |
| **All categories** (`/categories`) | always | The whole tree, picture and count per node, as links; the page behind the footer's "All categories" and the 404 |
| **Collections** (`/collections`, `/collections/:handle`) | always | Index of featured collections with pictures; each collection page as a leaf listing |

Filters: the category's own, size first and open (Baymard); on a landing page the filters of the parent. Empty states: a category with no products shows a message and its siblings, never a blank grid.

## 7. Footer and the other places

- **Footer**, four columns: *Shop* (top categories, New in, Sale, All categories), *Collections* (featured ones), *Help* (Track order, Delivery and returns, Size guide, Contact), *Company* (About, Privacy, Terms). The first two come from the data; the last two from the pages menu.
- **Search** suggestions include categories (DOC-06.11 §5.2); the no-results page and the 404 list the top categories.
- **Product page**: breadcrumb shows the full path; "More from <category>" rail.
- **Cart**: "Continue shopping" goes to the last category visited.
- **Sitemap and SEO**: every visible category and collection is in the sitemap; the landing page keeps its canonical URL; filter links in the panel are `nofollow,noindex` unless the category marks that filter as indexable (exists: `seoIndexable`).

## 8. Data and admin changes

| Change | Where |
|---|---|
| Category fields `showInMenu` (default true for visible top levels), `homeSpotlight` (default true), `menuImageMediaId` (optional; falls back to the picture) | contract `CategoryInput`, admin category drawer, public `CategoryNode` |
| `Navigation mode` setting: Automatic (default) or Custom menu | `StoreSettings`, Settings, Store card |
| `catalog.listCategories` returns, per node, up to 5 top filter values with counts (for the panel links) and `topProducts` thumbnails only when asked (`?spotlight=1`) | public catalog |
| Hide categories with no active product in the public tree; the admin still lists them with a "Hidden: no products" note | public catalog, admin list |
| Remove the seed's two-item `main` menu; seed category pictures and descriptions | seed |
| `/categories`, `/collections` routes | storefront |

## 9. How this is checked

1. **Coverage invariant** of §3, as an end-to-end test on the seeded data and as a unit test over a generated tree (one level, three levels, 20 top categories, an empty category, a hidden one).
2. Keyboard-only: open each panel, move through links, Escape returns focus; the same on the phone drawer; no-JavaScript: every panel link is present in the HTML.
3. Visual baselines of the open Women panel, a simple panel, the phone drawer at two levels, the home page, a landing page and a leaf page at 390, 768 and 1280 px.
4. Scorecard rows N1 to N6 and H2 of DOC-06.11 §8.3, plus new rows: **N7** a category with no products is not shown anywhere; **N8** every top category is on the home page twice; **N9** the landing page shows sub-category pictures.
5. The usability test of DOC-06.11 §8.4 adds one task: "find sandals for a wedding" and records the first click.
6. Tree test (Baymard-style): five people are given 10 products and asked where they would look; the share who choose the right top category should be at least 80%; wrong turns decide the labels.

## 10. Task impact (M8)

| Task | Adds |
|---|---|
| M8-02 | §8 data and admin changes, `/categories` and `/collections` routes, seed |
| M8-03 | §4 (bar, panels, phone drawer, utility row) |
| M8-05 | §6 leaf page chips, density, filter bar; landing page tiles and rails |
| M8-08 | §5 home composition |
| M8-01 | the coverage invariant test and the new scorecard rows |

## 11. Decisions for the owner

1. The real category names, and whether Men and Kids stay top level (the tree above is the demo).
2. Whether "Collections" is a menu item (recommended) or only on the home page.
3. Which collections are pinned in the bar besides New in and Sale (for example Eid edit during Eid).
4. Whether the shop sells for one gender mostly (then Women first and the others under "More", Khaadi style) or equally (then the bar above).

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-16 | Created from the admin's category tree and the research of DOC-06.11 §3 plus the category-page and navigation sources above |

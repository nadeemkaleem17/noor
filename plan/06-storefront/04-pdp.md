# 06.4 — Storefront: Product Detail Page

| Field | Value |
|---|---|
| ID | DOC-06.4 |
| Title | Product page: gallery, options, kinds, stock, sizing, add to cart |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-06.1, DOC-06.3 (card), DOC-04b, DOC-05 §7, §9 |
| Decisions used | ADR-0004, ADR-0011, ADR-0013, ADR-0014, ADR-0018, ADR-0020 |

## 1. Purpose and scope

**Governs:** `/p/:handle`: layout, the buy box, behaviour per product kind, stock states, size help, and what is sent to the cart.
**Does not govern:** cart behaviour after adding (DOC-06.5), JSON-LD and meta (DOC-06.9), the product model itself (ADR-0014, DOC-09 catalog).

Fixes F-10: today the storefront flattens a product to one price and a size list and ignores `kind`, `components`, `colorway`, `madeToOrder`, `sizeChartId`, `fit`, `customSizeSchemaId`, `seo`.

## 2. Layout

```
360 px                               ≥ 1024 px
┌──────────────────────────┐        ┌───────────────────────────┬──────────────────────────────┐
│ Home › Women › Lawn      │        │ Home › Women › Lawn › Embroidered Lawn 3-Piece           │
│ ┌──────────────────────┐ │        ├───────────────────────────┬──────────────────────────────┤
│ │   gallery (swipe)    │ │        │ ┌──┐ ┌──────────────────┐ │ RUBAYA                   │
│ │      1 / 6           │ │        │ │t1│ │                  │ │ Embroidered Lawn 3-Piece (h1)│
│ └──────────────────────┘ │        │ │t2│ │   main image     │ │ ★ 4.6 (38)                   │
│ RUBAYA               │        │ │t3│ │   3:4            │ │ Rs. 6,990  ~~8,490~~  -18%   │
│ Embroidered Lawn 3-Piece │        │ │t4│ │                  │ │ Colour: Teal   ● ● ●         │
│ ★ 4.6 (38)               │        │ └──┘ └──────────────────┘ │ Size: [S][M][L][XL] Size guide│
│ Rs. 6,990 ~~8,490~~ -18% │        │                           │ Only 3 left                  │
│ Colour: Teal  ● ● ●      │        │                           │ [-] 1 [+]  [ Add to cart ]   │
│ Size [S][M][L][XL]       │        │                           │ ♡ Save   WhatsApp us         │
│ Size guide · Find my size│        │                           │ 🚚 Delivery 3–5 days · COD   │
│ Only 3 left              │        │                           │ ▸ Details ▸ What's included  │
│ 🚚 3–5 days · COD        │        │                           │ ▸ Fabric & care ▸ Delivery   │
│ ▸ Details                │        ├───────────────────────────┴──────────────────────────────┤
│ ▸ What's included        │        │ Reviews (deferred)                                       │
│ ▸ Fabric & care          │        │ You may also like (deferred)                             │
│ ▸ Delivery & returns     │        └──────────────────────────────────────────────────────────┘
│ Reviews · Related        │
├──────────────────────────┤
│ Rs. 6,990  [Add to cart] │ ← sticky bar, appears once the main button scrolls out of view
└──────────────────────────┘
```

## 3. Gallery (`features/catalog/components/Gallery.tsx`)

| Rule | Detail |
|---|---|
| Source | `product.media` (images and video with `role`, `alt`, `width`, `height`, `lqip`), ordered as stored. `product.images` (the admin's simple gallery) is merged into `media` by the API so the storefront reads one list (DOC-09 decides the storage) |
| Variant images | Selecting an option value whose variant has `mediaIds` scrolls to the first of them |
| Mobile | Horizontal scroll-snap, one image per view, counter "1 / 6"; pinch-zoom via a full-screen `Dialog` opened by tapping |
| Desktop | Vertical thumbnail rail at inline-start + main image; click opens the full-screen dialog; arrow keys move between images |
| First image | `priority`; `sizes="(min-width:1024px) 50vw, 100vw"`; background is the `lqip` data URI until loaded |
| Video | Poster shown; plays on click; `muted`, `playsInline`, `preload="none"`; never auto-plays |
| Alt text | From `media.alt`; if empty, `"<title>, <role or 'image'> <n>"` |

## 4. Buy box

| Element | Rule |
|---|---|
| Brand | `product.brand`, small caps text; omitted if empty |
| Title | `<h1>`; `subtitle` below in `text-fg-soft` |
| Rating | Average + count, links to `#reviews`; omitted when `features.reviews` is off or there are no approved reviews |
| Price | `Price` for the **selected** variant; before a full selection, `From <lowest>`; `compareAt` struck through plus `-NN%` badge. Under it: "Inclusive of all taxes" |
| Colourways | `SiblingRef[]` of the same `styleId` as swatch **links** to each sibling's `/p/:handle` (each colourway is its own product, ADR-0014); current one marked `aria-current="true"`; label "Colour: Teal" |
| Options | One `OptionChips` group per `ProductOption`, rendered by `display`: `buttons`, `swatch`, or `select` (`NativeSelect`). Label shows the chosen value: "Size: M" |
| Unavailable value | A value whose every matching variant is `sold_out` is struck through and `aria-disabled`, still focusable; choosing it shows "Sold out in M" and the notify-me control |
| Selection default | Nothing preselected, **unless** the product has exactly one variant or `?size=` names a valid value |
| Size help | "Size guide" opens a `Drawer` with the product's `SizeChart` (table, in/cm toggle, how-to-measure image); shown when `sizeChartId` is set. `fit.note` renders as "Runs small: consider one size up" etc.; `fit.modelHeightCm`/`modelWears` render as "Model is 168 cm and wears M" |
| Stock line | Table in §6 |
| Quantity | `QuantityStepper`, min 1, max = `min(stock.quantity, stock.maxPerOrder)`; hidden for made-to-order with custom size (always 1 per line) |
| Add to cart | `Button variant="primary" fullWidth`. Label by state: "Add to cart", "Select a size" (pressing it focuses the first unselected option group and shows an inline message), "Sold out" (disabled), "Pre-order", "Order now" (made-to-order) |
| Wishlist | "Save" toggle |
| WhatsApp | `wa.me` link with the message `Hi, I have a question about <title> (<url>)` |
| Delivery line | "Delivery in <etaDays> days" from the default zone's cheapest method, "Cash on delivery available" when enabled, free-delivery threshold; made-to-order shows lead time instead |

## 5. Behaviour by product kind (ADR-0014)

| Kind | Options | Extra blocks | Add-to-cart rule |
|---|---|---|---|
| `stitched` | Size (from a size system) | Size guide, fit note, model info | Size required |
| `unstitched` | Usually none (one variant); sometimes "Pieces" (2-pc / 3-pc) | **What's included** table from `components[]`: piece, fabric, colour, technique, quantity (e.g. "Shirt · Lawn · 3 m"); note "Fabric only, stitching not included" | Direct when one variant |
| `made_to_order` | Size, including a `custom` option value when `customSizeSchemaId` is set | Lead time ("Made for you in 15–20 days"), deposit note, returnability ("Made-to-order pieces cannot be returned" when `returnable` is false) | Size required; choosing **Custom size** opens the measurement form (§7) and the line carries `customization` |
| `footwear` | Size (EU system) | Size guide with foot-length table | Size required |
| `accessory`, `home`, `beauty` | None or one (`material`, `other`) | Details only | Direct when one variant |
| `bundle` | Per child product: its own size choice | **In this set** list: each child with image, title and its size selector | All child sizes required; adds one cart line whose `customization.bundle` lists the chosen child variants (DOC-06.5 §3) |

"What's included", "Details" (`descriptionMd` rendered as sanitised Markdown + `highlights` as a list), "Fabric & care" (`attributes` of type fabric + `care[]`) and "Delivery & returns" (zone summary + link to `/pages/shipping-returns`) are `Accordion` items; "Details" is open by default.

## 6. Stock states (selected variant)

| `stock.status` | Stock line | Button |
|---|---|---|
| `in_stock`, quantity > 5 or unknown | "In stock" | Add to cart |
| `low_stock` or quantity ≤ 5 | "Only N left" (`text-warning`) | Add to cart |
| `sold_out` | "Sold out" | Disabled "Sold out" + notify-me (when `features.notifyMe`): phone field + "Notify me on WhatsApp/SMS" → `catalog.subscribeBackInStock` |
| `made_to_order` | Lead-time label from `madeToOrder.leadTime.label` | "Order now" |
| `preorder` | "Ships from <date>" | "Pre-order" |

Stock shown on the page can be up to 60 s stale (CDN cache). The truth is checked when adding to the cart and again at order creation (ADR-0020); the UI handles `insufficient_stock` there.

## 7. Custom size (made-to-order)

Rendered from the product's `FormSchema` (`customSizeSchemaId`): each `FormField` becomes an input (`NumberInput` with unit suffix in/cm, `NativeSelect`, or `Textarea` for notes) with min/max from the schema. The form opens in a `Drawer` with a how-to-measure illustration; values are validated with a Zod schema generated from the `FormSchema`; saved values appear as a summary under the size chips ("Custom: bust 36 in, length 42 in … Edit"). They are stored on the cart line as `customization.measurements` and travel to the order line unchanged.

## 8. Adding to the cart

A plain `<fetcher.Form method="post" action="/cart">` (works without JavaScript as a normal form post that redirects to `/cart`):

| Field | Value |
|---|---|
| `intent` | `add` |
| `variantId` | The selected variant |
| `quantity` | 1–`maxPerOrder` |
| `customization` | JSON string, only for custom size or bundle |

No price is sent (ADR-0020). Outcomes:

| Result | UI |
|---|---|
| Success | Cart drawer opens showing the new line; header badge updates; focus moves to the drawer title |
| `insufficient_stock` (with `available`) | Inline message under the button: "Only 2 available"; stepper max updated |
| `variant_unavailable` | Inline "This option just sold out"; page data revalidated |
| `max_per_order` | Inline "Limit of N per order" |
| `cart_full` (more than 50 lines) | Inline message |
| Network/5xx | Toast with Retry; button returns to idle |

## 9. Deferred sections

| Section | Data | Rules |
|---|---|---|
| Reviews (`#reviews`) | `reviews.listForProduct` (approved only), first 5 + "Load more" | Rating summary with a bar per star, fit summary ("78% say true to size") from `Review.fit`, customer photos open in a dialog, staff replies shown indented. Writing a review is by a link sent after delivery (DOC-06.6 §6); there is no open review form on the PDP in v1 |
| You may also like | `product.relatedIds` if set, else same primary category, 4–8 cards | Horizontal scroll-snap row on mobile |
| Recently viewed | Last 8 handles from a `nc_recent` cookie (written client-side) | Client-only, rendered after hydration; omitted when empty |

All three are deferred (DOC-05 §7) and absent from the page if they fail.

## 10. Loader

```ts
export async function loader({ params, request }: Route.LoaderArgs) {
  const res = await getProduct(params.handle, request)
  if (res.redirectTo) throw redirect(`/p/${res.redirectTo}`, 301)
  const product = res.product                                    // active only; else 404
  return data({
    product,
    sizeChart: product.sizeChartId ? await getSizeChart(product.sizeChartId, request) : null,
    customSizeSchema: product.customSizeSchemaId ? await getFormSchema(product.customSizeSchemaId, request) : null,
    reviews: features.reviews ? listReviews(product.id, request) : null,   // deferred
    related: listRelated(product.id, request),                             // deferred
  }, { headers: cache.listing })
}
```

`getProduct` returns the product with its `siblings` (colourways) embedded so the swatches need no second call.

## 11. Rules

**Always:** render title, price, options and the add-to-cart form in server HTML; show the selected variant's price and stock; send only `variantId`, `quantity` and `customization`.
**Never:** preselect a size when there is more than one; hide sold-out sizes; compute a discount percentage anywhere but `Price`; trust the cached stock figure as final.
**Common mistakes:** treating colourways as an option of one product (they are sibling products with their own URL); a disabled add-to-cart button with no explanation; opening the size guide in a new page and losing the selection.

## 12. Acceptance checklist

- [x] `curl /p/<handle>` contains `<h1>`, the price and a `<form … action="/cart">`. (`apps/storefront/test/shell.server.test.js` against a stand-in API, and by hand against the real one.)
- [x] One test product per kind in §5 renders its listed blocks and enforces its add-to-cart rule. (`shell.server.test.js` has one stand-in product for stitched, unstitched, made to order, footwear, bundle and accessory and checks each one's blocks; `home` and `beauty` take the accessory path. By hand with the real API: stitched, unstitched and made to order. A bundle was not tried with real data, and its "add" needs JavaScript. The add rules are `selection.test.js` and the browser.)
- [x] Pressing "Select a size" focuses the size group and announces the message. (By hand in the browser pane: the size group takes the focus and a `role="alert"` message says which choice is missing. Not tried with a screen reader.)
- [x] Adding 3 of a variant with stock 2 shows "Only 2 available" and adds nothing. (`shell.server.test.js`: the API's `insufficient_stock` with `available: 2` sends the visitor back with "Only 2 available." and nothing is added; with JavaScript the same code is shown under the button and the stepper's maximum drops to 2. Not run against the real API's stock, which `cart.int.test.js` covers on its side.)
- [x] A made-to-order product with a custom-size schema stores the measurements on the cart line. (By hand with the real API: bust, waist, hip and length typed for "Bridal Lehnga Ivory" are in `cart_lines.customization` as `{"measurements": {...}}`.)
- [x] Sold-out value is focusable, announced as unavailable, and offers notify-me when the feature is on. (By hand: every size of a sold-out product is a native radio marked `aria-disabled` with "sold out" in text for screen readers; choosing the last option gives a disabled "Sold out" button and the notify-me form, which saved a number through the API.)
- [ ] Gallery: swipe on touch, arrow keys on desktop, `Esc` closes the zoom dialog, focus returns. (Built: scroll-snap strip, thumbnails, a dialog with arrow keys and two buttons; the arrow key moving to the next picture was checked in the browser pane. Swipe on a touch screen, `Esc` and the focus returning were not tried.) **Open: manual (touch and keys).**
- [ ] No layout shift when images, reviews or related products load (CLS budget in DOC-06.10). (Every picture is drawn with its size and ratio, and the deferred sections reserve room; not measured.) **Open: not measured; Lighthouse CLS is one of the numbers of DOC-06.10 §2 that is met.**

## 13. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-06.4-1 | `media` vs `images` duplication in the contract | API returns one merged list | DOC-09 catalog |
| Q-06.4-2 | Bundle children in one cart line | As §5; stock is checked per child (GLOSSARY "Bundle") | DOC-09/DOC-10 cart |
| Q-06.4-3 | "Find my size" (`features.findMySize`) and compare (`features.compare`) | Not built in v1; the flags stay false | Owner asks |
| Q-06.4-4 | Review submission | By post-delivery link only | Owner wants open reviews → add moderation queue rules in DOC-07 |
| Q-06.4-5 | Tax line "Inclusive of all taxes" | Prices are tax-inclusive | Owner states otherwise |

## 14. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 2) |
| 2026-10-02 | Phase 7 consistency review: kind value `made_to_order` (DOC-09.0 §5) |
| 2026-10-07 | M5-04 built (`app/routes/product.jsx`, `features/product/*`, `lib/selection.js`, `lib/cart.server.js`, the `add` action in `routes/cart.jsx`). Notes: (1) The options are native radios drawn as chips (and a native select for `display: select`), not `OptionChips`, so choosing works without JavaScript; the form posts the radios (`opt.<optionId>`) with the product's handle and the server finds the variant with the same `variantFor` the page uses. With JavaScript the page sends `variantId` itself. A visitor without JavaScript who presses add with a choice missing is sent back to the product with `?cartError=invalid`. (2) The cart cookie `nc_cart` (HttpOnly, 30 days, Secure in production) is set by the first successful add, never by a page view; the cart route's `add` action is here because the page needs it, the cart page and the other intents are M5-05. A success shows "Added to cart · View cart" under the button; the cart drawer waits for M5-05. A foreign Origin is refused by React Router itself (400). (3) The measurements form is shown under the size when the custom size is chosen, inside the add-to-cart form, instead of a drawer of its own: the choice and the numbers stay in view, and no-JavaScript is not worse. (4) The information sections are native `<details>` (open: Details), so they work without JavaScript and a crawler reads them; "What's included" lists the components marked `included`. (5) Size guide: a `Drawer` with the tables, an in/cm switch (converted here, one decimal) and the how-to-measure picture. (6) Recently viewed is kept in the browser's localStorage (`nc_recent`, last 8 ids) and fetched after hydration from `/recent?ids=`, not written as a cookie: the page stays the same for everyone and cacheable. (7) Reviews: the first 5 come with the page (streamed), more through `/reviews/:id?cursor=` when asked; the rating, the bars by star and the staff reply are built; the fit summary ("78% say true to size") and the photo dialog (a photo links to the picture) are not. `ProductDetail` now carries `rating` (the average and count of approved reviews). (8) The sticky bar (price and button) is drawn on a phone whenever the real button is out of view, which includes the top of a long page; the observer was not exercised by real scrolling. (9) "Save" (wishlist) is M5-08; JSON-LD is M5-10. (10) A staff preview link passes its token to the API and the answer is `private, no-store`. (11) Notify-me posts to the product route's own action, which calls `catalog.subscribeBackInStock`; the form is outside the add form (no nested forms). |

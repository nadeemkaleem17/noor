# 06.17 — Every page of the shop, and where its content comes from in the admin

Written 2026-10-16, after M8 (storefront v2). For the owner and for anyone who edits the shop: **for each page a customer can open, what is on it, and which screen of the admin panel changes it.**

How to read the "Changed in" column: `Menu → Screen → Card or section`. The admin menu has these groups: **Overview** (Dashboard), **Sales** (Orders, Customers, Promo codes, Reviews), **Catalog** (Products, Categories, Collections, Attributes, Sizes & charts), **Content** (Home page, Pages, Menus) and **Settings** (Store, Appearance, Shipping, Payments, Staff, Audit log, Data).

"**Automatic**" means nobody types it: the shop works it out from other data (stock, sales, dates). "**Code**" means it is a fixed part of the design and only a developer changes it.

Customers see the name **Rubaya**; the pictures in the demo shop are generated placeholders until the owner uploads real photographs.

---

## 1. What every page has (the frame)

| Part | What the customer sees | Changed in |
|---|---|---|
| **Announcement bar** (top strip) | One line of text, optionally a link, with a close button | Content → Home page → **Announcement bar**. Up to five dated **Notices** that rotate: Content → Home page → **Notices** (text, link, start and end date) |
| **Logo and name** | The logo in the header, or the store name as text | Settings → Store → **Brand** (name, tagline, light logo, dark logo) |
| **Browser-tab icon** | The shop's icon | Settings → Store → **Brand** → favicon |
| **Colours, fonts, corners, picture shape, header layout** | The whole look of the shop | Settings → **Appearance** (starting point, colours, type and shape; the contrast check refuses unreadable text). The default look is called *Atelier*; *Gold*, *Monochrome* and *Botanical* are the others |
| **Header menu** (New in, Women, Men ..., Collections, Sale) | Each category with its sub-categories in a panel; "Collections" lists the featured collections; New in and Sale are fixed ends | **Automatic** from Catalog → **Categories** (name, order, visible, picture) and Catalog → **Collections** ("featured"). A category with no live product is left out. To write the menu by hand instead: Settings → Store → **Navigation bar** → "My own menu", then Content → **Menus** → `main` |
| **Search box** | Suggestions while typing; recent searches (kept in the customer's browser); popular searches | Suggestions are **automatic** from products, categories and collections. The popular words: Settings → Store → **Popular searches** (one per line, up to 8) |
| **Wishlist heart, bag** | Count in the bag; the bag opens from the right | Automatic (the customer's own browser and cart). The wishlist can be switched off: Settings → Store → **Features** |
| **Track order link** | In the header and footer | Code |
| **Footer** | Shop and Collections columns; Help and Company columns; contact details; payment methods; the trust row; "About" sentence | Shop and Collections: **automatic** from categories and collections. Help and Company: Content → **Menus** → `footer` (a page whose address is `shipping-returns`, `contact`, `faq` or `care` goes under Help; the rest under Company). "Offers" appears under Help while at least one promo is public. Contact lines: Settings → Store → **Contact**. Payment methods: Settings → **Payments**. The "About" sentence: Content → Home page → **Footer** |
| **Trust row** (cash on delivery, N-day returns, WhatsApp support) | Three links at the foot of every page and under the buy button | Each appears only if it is true: cash on delivery switched on in Settings → **Payments**; the number of days in Settings → Store → **Policies** → returns window; the WhatsApp number in Settings → Store → **Contact** |
| **WhatsApp button** (round, bottom corner) | Opens WhatsApp with a short greeting | Settings → Store → **Contact** → WhatsApp number (none, no button) |
| **Language** | English only | Settings → Store → **Languages**. Urdu exists in the code but is switched off |

---

## 2. Page by page

### Home — `/`

| Section | What the customer sees | Changed in |
|---|---|---|
| **Hero** | Big picture slides with a heading, a line and a button; swipe, arrows, pause | Content → Home page → **Hero slides** (up to 6: picture, picture description, heading, line, button text and link) |
| **Trust strip** | "Free delivery over Rs 5,000 · Cash on delivery · 7-day returns · WhatsApp support" | **Automatic**: the free-delivery amount is the lowest "free above" of any zone in Settings → **Shipping**; the others as in the trust row above |
| **Round category pictures** | A circle with a picture and name for each top category | **Automatic** from Catalog → **Categories**; the picture is the category's own picture |
| **New in** (with a tab for each top category) | Eight pieces; a tab swaps to one category | **Automatic**: products published in the last 30 days or marked *New* (Products → the product → **Organisation** → badges). The tabs are the top categories |
| **Collections** | Up to three tiles with a picture and name | Catalog → **Collections**: a collection that is *active*, *featured* and inside its dates; its picture is the collection's own |
| **A block for each top category** | Picture, name, four best sellers, "Shop <category>" | **Automatic**: needs the category to have a picture and at least two products |
| **Promo band** | A coloured band: small label, heading, line, button | Content → Home page → **Promo band** (switch on/off, text, button) |
| **Bestsellers** (with tabs) | Eight pieces | **Automatic**: ordered by how many have sold (counted from real orders) |
| **Editorial band** | Picture with text and a button | Content → Home page → **Editorial band** |
| Page title and description for Google | | Settings → Store → **Search** → home page description |

### Category page — `/c/women`, `/c/stitched`, …

| Section | What the customer sees | Changed in |
|---|---|---|
| Title, short text, picture | Heading, an intro (long text folds under "Read more") and the category picture | Catalog → **Categories** → the category (name, description, picture) |
| **Sub-category tiles and two rails** (only on a category that has children) | A tile for each sub-category with picture and piece count; "New in Women" and "Bestsellers in Women" | **Automatic** from the category tree and the products in it |
| **Sibling chips** (on a category with no children) | "More categories": the others at the same level | **Automatic** |
| **Filters** | Size first, then colour, price, availability and the category's own filters (fabric, pieces, occasion …) | Which filters a category has: Catalog → **Categories** → the category → filters. The values: Catalog → **Attributes**. Size: Catalog → **Sizes & charts**. Colour and price: from the products |
| **Sort, count, density switch** | Featured, newest, price, bestselling; how many products per row | Code. The "Featured" order uses a ranking number that the admin does not let staff set yet (a gap: until then, "Featured" and "Newest" look alike) |
| **Product cards** | See "Product card" below | Products |

### All categories — `/categories`
Every category with its picture, piece count and its sub-categories as links. **Automatic** from Catalog → **Categories**.

### Collections — `/collections` and `/collections/eid-edit`
The index lists featured collections; each collection page lists its products. Catalog → **Collections** (title, text, picture, which products and in what order, start and end dates, active or draft).

### New arrivals `/new` and Sale `/sale`
**Automatic.** New = published in the last 30 days or marked *New*. Sale = a product or size has a **compare-at price** higher than its price (Products → the product → **Options and variants**). The percentage shown on the card is worked out from the two prices.

### Search results — `/search?q=…`
Products that match the words (names, codes, categories, synonyms), with the same filters as a category. A search with no result shows the words again, the popular searches (Settings → Store → **Popular searches**), the categories, new pieces and a WhatsApp link. Searches that found nothing are listed for staff in the Dashboard.

### Product card (in every grid)
| On the card | Changed in |
|---|---|
| Picture; a second picture on hover | Products → the product → **Media** (the first two pictures) |
| Name; the fabric line under it ("Lawn \| Casual wear") | Products → **Basics** → title and **subtitle** |
| Price; the old price struck through | Products → **Options and variants** (price, compare-at). The card shows the lowest price, "From" when sizes differ |
| Badges: *New*, *-20%*, *Bestseller*, *Limited*, *Made to order*, *Sold out* | New, the percentage, Made to order and Sold out are **automatic**; Bestseller and Limited are switches in Products → **Organisation** |
| Colour dots | Products → **Colourway** (products of the same "style" with different colours link to each other) |
| Stars and the number of reviews | **Automatic** from approved reviews (Sales → **Reviews**); shown from 3 reviews |
| "Only 2 left" | **Automatic** when the pieces left are at or under the low-stock number: Settings → **Shipping** → *Other delivery settings* → low-stock threshold |
| **Quick add** (sizes under the card) | **Automatic** for a piece sold in sizes only; a sold-out size is struck through. Stock: Products → the stock dialog, or Orders as they ship |
| Heart | The customer's own wishlist |

### Product page — `/p/cotton-kurta`
| Section | What the customer sees | Changed in |
|---|---|---|
| Breadcrumb | Home › Women › Stitched › the piece | The product's main category: Products → **Organisation** |
| **Gallery** | Thumbnails (desktop), swipe (phone), enlarge | Products → **Media** (order, picture descriptions, which picture belongs to which colour) |
| Name, brand, subtitle, price, "inclusive of all taxes" | | Products → **Basics**, **Options and variants** |
| **Colour links** | The same style in other colours | Products → **Colourway** |
| **Size buttons** with sold-out sizes struck through and "2 left" | | Products → **Options and variants** (sizes, price, stock per size). The sizes come from Catalog → **Sizes & charts** |
| **Size guide** (drawer) and "model wears" | The measurement table and how to measure | Catalog → **Sizes & charts** (charts), attached in Products → **Sizing** |
| **Custom size** form (made to measure) | Measurements, notes | Catalog → **Sizes & charts** → forms; switched on in Settings → Store → **Features** → custom sizing; the lead time and deposit in Products → **Made to order** |
| **Quantity, Add to bag, Notify me** | The button changes with stock; "Notify me" takes a mobile number when a size is sold out | Stock as above. "Notify me" can be switched off: Settings → Store → **Features** |
| **Delivery block** | Delivery days, "Dispatched within 1–2 working days", cash on delivery, free-delivery amount, and **Check delivery to your city** (fee and days for that city) | Days, fees, free-above and the cities: Settings → **Shipping** → Zones and Cities. The dispatch promise: Settings → **Shipping** → *Other delivery settings*. Cash on delivery: Settings → **Payments** |
| **Trust points**, **Save**, **Ask on WhatsApp**, **Share on WhatsApp** | | Contact and policies as in section 1 |
| **Details, What is included, Fabric and care, Delivery and returns** | Description (Markdown), highlights, the pieces in a suit, care lines, plus a link to the care guide | Products → **Basics** (description), **Details** (highlights, care), **What's included**, **Attributes** (fabric etc.). The care guide is the page `care` (Content → Pages) |
| **Reviews** | Average, bars for 1–5 stars, "9 of 12 reviewers said it fits true to size", the reviews | A review appears only after staff approve it: Sales → **Reviews**. The customer writes it from the link on their order page after delivery |
| **You may also like**, recently viewed | | Products → **Related products** first, then **automatic** (same category, best selling) |
| **Search-engine title and description, address** | | Products → **Search and address** |
| Sticky buy bar on phones | | Code |

### Bag — `/cart` and the bag panel
| Section | Changed in |
|---|---|
| Lines (picture, name, size, price, quantity, remove), "price changed" / "only 2 left" notes | The cart itself; prices and stock come from Products |
| **Promo code box** | Sales → **Promo codes** |
| **Free-delivery progress** ("Add Rs 1,200 more for free delivery" and a bar) | **Automatic** from the lowest free-above amount of any zone: Settings → **Shipping**. Once a city is chosen at checkout, that city's amount is used |
| Total, deposit for made-to-order pieces | Automatic; deposit: Products → **Made to order** |
| **You may also like** (page only) | **Automatic**: pieces related to the first one in the bag |

### Checkout — `/checkout`
One page, no account. The customer gives name, mobile number, city, address, optional email and notes.
| Part | Changed in |
|---|---|
| **City list** and the delivery options with fee and days | Settings → **Shipping** → Cities and Zones (which city is in which zone; fee, days, free-above, cash on delivery allowed) |
| **Payment methods** | Settings → **Payments** (cash on delivery with its words; bank transfer). Very large cash orders are refused or need a deposit: Settings → Payments → the cash-on-delivery limit |
| **Extra questions** and the marketing consent box | Settings → Store → **Checkout** (extra fields, consent text) |
| Terms and returns links | The pages `terms` and `shipping-returns` (Content → **Pages**) |
| Trust line "Pay when it arrives…" | Code |
| The order number's letters | Settings → Store → **Prices** → order number prefix |
| Orders from a number that refused before | Sales → **Customers** ("no cash on delivery") |

### Order page — `/orders/<private link>`
What the customer gets after ordering. Status timeline, items, delivery address, totals, the courier and **tracking number with a link to the courier's page** once dispatched, "what you can still do" (cancel before dispatch, switch to cash on delivery), print invoice, review links after delivery, and a WhatsApp help button with the order number.
| Part | Changed in |
|---|---|
| Status, dates, notes | Sales → **Orders** → the order (confirm, pack, dispatch, deliver, cancel) |
| Courier names and the tracking-link pattern | Settings → **Shipping** → **Couriers**; the tracking number is typed when staff dispatch the order |
| Messages to the customer (placed, confirmed, dispatched, delivered) | Written to a log today; sent by WhatsApp or SMS only once a provider is connected (not yet) |

### Track an order — `/track`
The customer enters the order number and mobile number and gets the same page as above. A wrong number and an unknown order give the same answer. Nothing to edit.

### Review form — from the order page
After delivery the customer rates each piece, writes a few lines, says how it fitted and may add pictures. It waits as *pending* until staff approve it: Sales → **Reviews**.

### Wishlist — `/wishlist`
The pieces the customer hearted, kept in their own browser (no account). Switched off with Settings → Store → **Features** → wishlist.

### Offers — `/offers`
A list of promo codes with what each one gives ("10% off, on orders over Rs. 5,000. Once per customer.") and a **Copy code** button. Sales → **Promo codes** → the code → tick **Show on the shop's Offers page**. Only codes that are switched on and inside their dates are shown. The footer links to the page while there is at least one.

### Written pages — `/pages/<name>`
Each is a page you can edit as text: Content → **Pages** (title, address, text, status, search title and description). Pages in the demo shop:

| Page | What it says | Where its numbers come from |
|---|---|---|
| **About us** (`about`) | Who we are, how an order is made and sent, where the shop is | Phone, WhatsApp, email and address are filled in from Settings → Store → **Contact**; the return days from **Policies** |
| **Shipping & returns** (`shipping-returns`) | Delivery, payment, tracking, made-to-order, returns, how to return, and **a list of delivery areas with fee, days and free-delivery amount** | The list and the amounts come from Settings → **Shipping** (so they are never typed twice); return days from Settings → Store → **Policies** |
| **Questions and answers** (`faq`) | Ordering, paying and delivery, sizes, returns, care. Google also reads it as a question-and-answer page | Each question is a line starting with `###`; the delivery amount and return days come from Shipping and Policies |
| **Fabric and care** (`care`) | How to wash lawn, khaddar, chiffon, silk, bridal | Plain text. Linked from every product's "Fabric and care" |
| **Contact us** (`contact`) | Phone, WhatsApp, email, address, opening hours, map link, social links | Settings → Store → **Contact** |
| **Privacy policy**, **Terms of service** | Drafts of the usual texts. **The owner and a lawyer must read these before opening** | Contact details from Settings → Store |

The four pages `shipping-returns`, `privacy`, `terms` and `contact` are protected: they cannot be deleted or renamed, because the checkout links to them. The words `{{store.phone}}`, `{{store.whatsapp}}`, `{{store.email}}`, `{{store.address}}`, `{{shipping.fee}}`, `{{shipping.freeAbove}}`, `{{shipping.table}}` and `{{returns.days}}` inside a page's text are replaced with the real numbers when the page is shown.

### Size guide — `/size-guide`
Every size chart with its tables and how to measure. Catalog → **Sizes & charts**.

### 404 and error pages
The shop's own "we can't find that page" with search and categories. A short error page when the API is down. Code.

### Search-engine files — `/sitemap.xml`, `/robots.txt`
**Automatic.** Only the real domain (`rubaya.pk`) asks Google to index; any other address is told to stay out.

### Design specimen — `/design`
For the team only: every colour, text size, button and form field in one page. It does not exist on `rubaya.pk`.

---

## 3. "I changed X in the admin — what changes in the shop?"

| In the admin | Changes in the shop |
|---|---|
| Settings → Store → Brand | Logo, name in the header, footer, tab title, favicon |
| Settings → Store → Contact | WhatsApp button, footer, Contact page, "ask on WhatsApp", trust row, About page, page words `{{store.…}}` |
| Settings → Store → Prices | Whether "Rs 6,990" shows paisa; rounding; the order number letters |
| Settings → Store → Features | Wishlist, reviews, back-in-stock, custom size on or off |
| Settings → Store → Navigation bar | Header menu automatic or your own (Content → Menus → main) |
| Settings → Store → Popular searches | The words under the search box and on the search pages |
| Settings → Store → Policies | Return days in the trust row, the pages and the product page |
| Settings → Store → Checkout | Extra checkout questions, marketing consent |
| Settings → Store → Search | The home page's description for Google |
| Settings → Appearance | All colours, fonts, corners, picture shape, header layout, "keep header at the top" |
| Settings → Shipping | Delivery fees, days and free-delivery amounts everywhere (bag, checkout, product page, trust strip, Shipping page); the city list; couriers; the dispatch promise; the low-stock number |
| Settings → Payments | Payment methods at checkout; "Cash on delivery" in the trust row and footer |
| Content → Home page | Announcement, notices, hero, promo band, editorial band, footer sentence |
| Content → Pages / Menus | The written pages; the footer's Help and Company columns |
| Catalog → Categories | The header menu, home circles and blocks, category pages, filters |
| Catalog → Collections | The Collections row, collection pages, the header's Collections panel |
| Catalog → Products | Everything about a piece |
| Sales → Promo codes | The bag's code box; the Offers page (when made public) |
| Sales → Reviews | Stars on cards, the reviews on product pages |
| Sales → Orders | The customer's order page and tracking |

## 4. What nobody edits (and why)

- **Order of "Bestsellers"** and the **New** badge: counted from real sales and dates, so they cannot be faked.
- **"Only N left"** and sold-out sizes: from the real stock count, never invented urgency.
- **Prices in the bag and at checkout**: always worked out by the server; the browser cannot change them.
- **The look of buttons, spacing and animation**: part of the design system (Appearance changes colours and shape, not the rules).

## 5. Known gaps (so nobody is surprised)

- A category has no search-engine title or description field in the admin yet (products and pages do), and there is no control for the "Featured" sort order.
- The bestsellers on the home page load with a script; without JavaScript that section is not shown.
- The header's "shop by" filter column and picture tile inside a menu panel are not built; the category pages carry the filters.
- No customer reviews strip on the home page and no "shop by occasion" tiles yet.
- Order messages by WhatsApp or SMS wait for a provider.
- Returns and exchanges are handled by phone or WhatsApp today; an online request form and an admin returns queue are planned (M8-11).
- Real delivery fees, contact details, return days and the owner's reading of the policy pages are still the owner's to fill in before opening (`pnpm --filter @noor/api cli launch:check` lists what is missing).

Related documents: [site blueprint](14-site-blueprint.md) (every function with an id), [admin-to-shop coverage](12-admin-coverage.md) (which admin controls reach the shop), [navigation](13-navigation-and-categories.md), [design system](15-design-system-v2.md).

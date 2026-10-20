# 17 — Owner requests of October 2026: marked up against the system as it is

Source: the Word file "RUbaya Projects problems.docx" (13 items, 10 screenshots) and the owner's message of 2026-10-19 (item 14, delivery assignment). Nothing here is built yet: this is the understanding we discuss first.

How each item is marked: **Ask** (what we understood), **Today** (what the system does now, checked in the code and the database on 2026-10-19), **Gap**, **Proposal**, **Size** (S under 1 day, M 1 to 3 days, L 3 to 8 days, XL more), **Decide** (questions that change what we build).

Legend for the table in section 1: ✅ already there · 🟡 partly · 🔴 missing · 🐞 a fault to fix · ❓ needs a decision first.

---

## 1. The 14 items at a glance

| # | Item | Kind | Today | Size | Priority I suggest |
|---|---|---|---|---|---|
| 1 | Categories added in the admin do not show on the website | 🐞 + ❓ | ✅ **Stage 1 built 2026-10-19**: Store setting "show categories with no products" (on by default), "coming" page, admin says why a category is not shown | S to M | 1 (quick, visible) |
| 2 | "New in" settings missing on the home page (the Sale band has them) | 🔴 | ✅ **built 2026-10-20** with 3: heading, count and on/off for New in, Bestsellers, Collections, Category pictures, Category blocks | M | 2, built together with 3 |
| 3 | Home, header, theme and category display settings in the admin, with layouts, order, preview | 🔴 | 🟡 **sections can now be ordered, switched off and sized (2026-10-20)**; draft and publish, other category layouts and header options are still open | L | 2 |
| 4 | Notice management: popup, side and header notices, colours, design | 🔴 | ✅ **built 2026-10-20**: `/content/notices` with strip, popup and side card, five colour pairs, dates, on/off, popup frequency | M to L | 3 |
| 5 | Image upload spinner never stops | 🐞 | ✅ **Stage 1 built 2026-10-19**: worker runs inside the API locally, inline fast path, upload with progress, cancel, retry and a clear failure, admin banner when the worker is down | S | **1 (blocks everything else)** |
| 6 | Bulk delete everywhere | 🔴 + ❓ | ✅ **built 2026-10-20**: Delete in the bulk bar of Products, Promos, Collections, Pages, Attributes, Subcategories (real delete; trash still open) | M | 3 |
| 7 | A Subcategories tab | 🔴 | ✅ **built 2026-10-20**: `/subcategories` with search, parent filter, add, edit, delete, bulk delete | S to M | 2 |
| 8 | Product search does not work | 🐞 | ✅ **Stage 1 built 2026-10-19**: index health, repair job every 10 minutes and at start, "Rebuild the search index" button, title-prefix safety net | S | 1 (same cause as 5) |
| 9 | Visitor tracking and analytics | 🔴 + ❓ | 🔴 (only anonymous speed and error numbers) | XL | later, after a privacy decision |
| 10 | User management and role-based login | ✅ | ✅ staff, invites, roles, two-step sign-in | 0 to S | check the screens with the owner |
| 11 | Module-based rights per user | 🔴 | ✅ **built 2026-10-20** as module access per person (extras and removals on top of the role); custom named roles not built | L | 4 |
| 12 | 10 to 12 website themes | 🔴 + ❓ | ✅ **built 2026-10-20**: 12 presets (4 + 8, one dark) as a preview gallery in Appearance (tokens.md §4.2.1); a layout-level theme (different page structure) is not built | M (colours) to XL (layouts) | 3, after we agree what "theme" means |
| 13 | Order email notifications with admin settings, templates, preview, test send and log | 🔴 | ✅ **built 2026-10-20**: `/settings/emails` with on/off for six events, own wording with tokens, sender name and reply-to, preview, test send, log | L | 3 |
| 14 | Delivery assignment, rider ledger, receipts, bulk assignment | 🔴 + ❓ | ✅ **built 2026-10-20** with the defaults of plan/18 §2 (delivery people, runs with bulk assignment, rider ledger, receipts, history); change a default by telling me | XL | 4, a design discussion first |

**One root cause sits behind 5, 8 and 13** (and part of 1): the background worker is not running in the normal local set-up. See item 5.

---

## 2. Item by item

### 1. Categories do not appear on the website

**Ask.** Every active category made in the admin shows on the website, honouring visibility and parent; changes appear by themselves; works on desktop and phone.

**Today.** The screenshots show "Volume 1" (1 product), "For api" and "for testing api" (0 products) and a sub-category "related to volume" (0 products) in the admin, and a header without them. The shop deliberately shows a category only when it has at least one *live* product, and only when it is switched visible (rule N7 in DOC-06.13, added in M8-02 so that a customer never lands on an empty page). Other reasons a category can be missing:
- "Volume 1" says "1 product" in the admin, but the admin count includes draft products; the shop counts active ones only.
- The round pictures and the category blocks on the home page also need the category to have a **picture** (and, for the blocks, at least two products).
- The shop keeps the category list for 30 seconds, so a category added a moment ago can take up to half a minute.
- The header holds 8 items; more go under "More".

**Gap.** The owner expects "I made it, it is there". Our rule contradicts that for new, empty categories.

**Proposal.** One setting in Settings → Store, **"Show categories that have no products yet"** (on = every visible category appears in the header, footer and on /categories; its page shows "Coming soon" with the sibling categories). Default: on, because that matches the request. Also: say in the admin list *why* a category is not shown on the shop ("0 live products", "hidden", "no picture for the home page"), so nobody has to guess. Reduce the 30-second wait for category changes (clear the shop's cache when a category is saved).

**Size.** S to M. **Decide.** Show empty categories by default, yes or no?

---

### 2. "New in" settings missing on the home page

**Ask.** The Sale band has a card in Content → Home page (heading, text, button). "New in" has nothing.

**Today.** The home page "New arrivals" grid is automatic: the 8 newest pieces (published in the last 30 days, or marked New), with fixed words. The header's "New in" is a fixed link to /new. No setting touches either.

**Gap.** Heading, how many pieces, how "new" is defined, the "View all" link, show/hide, and the same for Bestsellers, collections and the category blocks.

**Proposal.** Treat the home page as a list of **sections** (item 3): hero, trust strip, categories, **New in**, collections, category blocks, promo band, **Bestsellers**, editorial. Each gets: show/hide, a heading, how many pieces (4 to 12), and for New in the rule ("published in the last N days" or "pieces I choose" or "a collection"). Header links ("New in", "Sale") get their label and visibility in the same place.

**Size.** M (with 3). **Decide.** Is "new" a time window (last 14, 30, 60 days) or a hand-picked list?

---

### 3. Home page, header, theme and category display settings

**Ask.** The admin should control, without code: how many categories show on the home page and where; layouts (grid, list, cards, horizontal scroll); show/hide and order per category; live preview; save and it goes live; responsive.

**Today.**
- Appearance (colours, fonts, corners, picture shape, header layout left/centre, sticky) with a live preview. ✅
- Categories can be hidden and re-ordered (arrows) in Catalog → Categories, but that is one order for the whole shop. ✅
- Content → Home page: announcement, notices, hero slides, promo band, editorial band, footer sentence; a "Preview storefront" button. 🟡
- Missing: which categories appear on the home page and how (count, layout, order); the order of home sections; header menu design options; per-section layout.

**Proposal.**
1. A **Home page layout** screen: an ordered list of sections with on/off and drag to reorder; each section has its own small settings card.
2. **Category display** card: how many (all, or the first N), layout (round pictures, cards, grid, list, horizontal scroll), position (under the hero, or after New in), and a per-category "Show on the home page" switch with its own order.
3. **Header** card: menu automatic or hand-made (exists), layout, sticky (exist), show/hide "New in", "Sale", "Track order", search style.
4. **Preview**: the existing "Preview storefront" shows the *saved* shop. A true "see before you publish" needs the shop to read a draft: save as *draft*, preview with a private link, then **Publish**. This is the main piece of work.

**Size.** L. **Decide.** Is a draft-and-publish flow required, or is "save, then look at the shop" enough for now?

---

### 4. Notice management

**Ask.** A notices screen: create, edit, delete, activate/deactivate; title, description, colours and design; a display position (popup on opening, side notice, notice above the header); correct on phone and desktop; applied without code.

**Today.** Content → Home page → Notices: up to 5 short messages (text, link, kind info/promo/notice, start and end date) shown one after another in the strip above the header, together with the announcement bar. No title or description, no colours, no popup, no side notice, no separate screen, no on/off switch other than deleting.

**Proposal.** A real **Notices** screen (Content → Notices) with a list and an editor: title, description, optional button and link, position (header / popup / side), colours (from a small set that passes the contrast check), start and end date, active switch, order. The shop shows a popup once per visitor per notice (remembered in their browser, with a close button and a "don't show again" for the session), a side notice as a small fixed tab that opens, a header notice in the strip. The popup is a proper dialog: focus is trapped, Escape closes, nothing opens on top of the checkout.

**Size.** M to L. **Decide.** How often may a popup appear (every visit, once a day, once ever)? Several notices at once: queue them or show the newest only?

---

### 5. Image upload: the spinner never stops 🐞 **cause found**

**Ask.** Uploads work everywhere; the spinner stops; success and error messages; all formats and sizes.

**Today / diagnosis (verified).** The upload has three steps: the browser asks for a slot, sends the file, then tells the server "it is there"; the server then makes the sizes in a **background job** (`media.process`). In this development database there are **5 `media.process` jobs waiting with 0 attempts, the oldest from 7 October**, and uploads from 16 October that were sent and confirmed but are still `pending`. Nothing is processing them because **the background worker is off**: `DEV_INLINE_WORKER` is not set in `apps/api/.env`, `pnpm dev` starts only the API, and the "api" server the tools use (`pnpm start`) does the same. So the picture stays "pending" and the admin keeps waiting (after about 30 seconds it should say "still being processed", but the picture field shows a spinner and the screenshot was taken before that).

This is the same cause as item 8 (new and edited products are not added to the search index until the worker runs) and it will hit item 13 (emails are sent by the same worker).

**Fix.**
1. Run the worker with the API by default when working locally (`DEV_INLINE_WORKER=1` in `.env.example`, set it in `.env`, and make `pnpm dev` start the worker). Add an admin warning, "The background worker is not running; pictures, search and emails are waiting", using the queue age we already know.
2. Process a small picture **during the confirm request** instead of in the queue, so the usual case needs no waiting at all.
3. Make the field always end: a visible timeout (not an endless spinner), a clear message ("Sent, still being made ready. We will keep trying."), and "Try again".
4. Re-run the 5 stuck jobs.
5. Test in Firefox as well as Chrome (the screenshots are Firefox).
6. Say the rules out loud in the field: JPEG, PNG, WebP, AVIF, up to 10 MB, long side at least 800 px (logos and icons less).

**Size.** S. **Decide.** Nothing: this one we simply fix first.

---

### 6. Bulk delete

**Ask.** Select several rows with checkboxes, delete them in one action, with a confirmation.

**Today.** Lists with checkboxes and a bulk bar: Products (publish, back to draft, archive), Orders (confirm, dispatch, deliver, print), Promo codes (switch on/off). No bulk delete anywhere; single delete exists for categories, collections, attributes, size charts, pages, promos (only unused ones), couriers are disabled not deleted.

**Rules we must keep** (they protect the books): an **order is never deleted** (it can be cancelled); a **product with orders is archived**, not deleted; a category, attribute or size that products use cannot be deleted (the shop says what uses it); staff are switched off, not deleted; the audit log cannot be deleted; customers are not deleted (a privacy erasure is a separate, careful action).

**Proposal.** "Delete selected" on every list where deleting is allowed (categories, sub-categories, collections, attributes, size charts, pages, promos, reviews, notices, media, products without orders). The confirmation names the count and the first few names; the result lists what was deleted and what was refused, with the reason. Everything is written to the audit log.

**Size.** M. **Decide.** Real delete or a **trash** that can be restored for 30 days? (Trash is safer and costs a little more.)

---

### 7. Subcategories tab

**Ask.** A separate Subcategories tab: a table of all sub-categories, each tied to its parent; view, add, edit, delete; search and filter.

**Today.** Catalog → Categories is a tree with expand arrows, up to three levels; "Add a subcategory" is inside each category. No flat table, no search, no filter by parent.

**Proposal.** A **Subcategories** screen beside Categories: a table (name, parent, product count, visible, order) with search, a filter by parent, add/edit in a side panel, delete and bulk delete. It reads the same data as the tree, so the two never disagree. (If a third level is used, the table shows the path "Women › Stitched".)

**Size.** S to M.

---

### 8. Product search does not work

**Ask.** Search by name, code or keyword; all matches; works on phone; a message when nothing matches.

**Today (verified).** On a healthy shop it works: a search for "Embroidered Khussa", "khussa", "kurta" and a product code all return results (checked against the dev API today); the code is matched first, then words with prefixes and synonyms; there is a no-results message with suggestions. The screenshot (phone, "Embroidered Khussa", 0 products) shows a shop whose **search index is empty or stale**. The index is kept up to date by a background job after every product change, and the full index is built when the demo data is seeded; if the worker is off (item 5), products added or edited later are never indexed, and an index that was never built returns nothing.

**Proposal.**
1. The worker fix of item 5.
2. A **"Rebuild search index"** button in Settings → Data, and a check at start-up: an empty index with products in the shop rebuilds itself.
3. A safety net: if the full-text search finds nothing, try a plain "name starts with" match so a freshly added product is still found.
4. Typing tolerance is already there for synonyms (kurti/kurta); add the owner's own words in a small admin list (synonyms exist in the database, with no screen yet).
5. A test that adds a product through the admin and finds it by name and code within a few seconds.

**Size.** S. **Decide.** Do we need typo tolerance ("kurtaa")?

---

### 9. Visitor tracking and analytics

**Ask.** Record every visit, even without a form: IP, date and time, pages, visits and session length, device, browser, operating system, approximate location, referrer; show it in the admin; do not claim to know who anonymous visitors are; follow privacy law and consent.

**Today.** Only anonymous page-speed numbers (Core Web Vitals) and script errors are sent from the browser; the dashboard shows searches that found nothing. No visits, sessions, pages, devices or sources. The shop sets only **necessary cookies** (cart, wishlist) and has no cookie banner, which is a deliberate position in the plan.

**What it takes.** A small collector in the shop (one request per page view, sent when the page is hidden so it never slows a page down), a store of visits, a session id (first-party, 30 minutes idle), reading the browser's description (device, browser, system), the referrer, optional approximate location from the IP address (a local IP-to-place database, so nothing is sent to a third party), bot filtering, retention, and admin screens (today, pages, sources, devices, countries, sessions).

**Privacy decisions that change the build** (this is the part to discuss):
- **IP address.** Storing full IPs is personal data in many laws. Options: keep it truncated (last part removed) or hashed with a daily key (counts unique visitors without being able to name anyone), or keep it in full for a short time (for example 30 days) for security. The owner's wording "where legally permitted" points to the first two.
- **Consent.** If we only count anonymous, first-party, aggregate visits, many laws do not require a banner. If we keep a persistent visitor id or full IP, we need a consent banner and a "decline" that really stops it. Pakistan's data-protection law is still a draft and the shop may be visited from the UK/EU; we should choose the stricter safe design.
- **"Identify" a visitor.** We will never show a name, phone or email for someone who did not give it; a customer who orders can be linked to *their own* order only, with the order number.
- **Alternative to building it:** a self-hosted analytics tool (Plausible or Umami, cookieless) gives most of this in a day, with its own dashboard; building it inside the admin gives one place to look, costs weeks, and we own the privacy risk.

**Size.** XL to build; S to install a ready-made tool. **Decide.** Build inside the admin, or embed a ready-made tool first? IP: truncated, hashed or full? Consent banner: yes or no?

---

### 10. User management

**Ask.** Create and manage users; only authorised people log in; role-based permissions.

**Today. ✅** Settings → Staff: invite by email, roles (owner, manager, catalog, fulfilment, support, viewer), switch a person off, reset password, two-step sign-in (required for owner and manager), password rules, every change in the audit log. Sign-in is by server session with a cookie; no shared key.

**Gap.** Probably only that the owner has not seen it. Worth confirming on screen: invite, role change, deactivate, sign-in refusal. One missing piece: **creating a user with a temporary password** (today it is by invitation link).

**Size.** 0 to S.

---

### 11. Module-based user rights

**Ask.** Per user, allow or deny each module and each function in it.

**Today. 🟡** Permissions are fine-grained (about 40, such as `orders:dispatch`, `products:delete`, `settings:write`) but are fixed per **role** in code; there is no screen to change them and no per-user exceptions.

**Proposal.** Custom **roles** edited on a screen: a matrix of modules (Products, Orders, Customers, Catalog, Promos, Reviews, Content, Settings, Staff, and the new Delivery and Ledger) against actions (view, create, edit, delete, export, plus special ones such as confirm, dispatch, refund). Assign a role to a user and, optionally, extra allow/deny on that user. The server already refuses what is not allowed, so this is mainly the screen, a roles table (the plan said "no roles table in v1" and this reverses it: record as a decision) and the safeguards: nobody can give more than they have, the owner role cannot be removed, the last owner cannot be demoted.

**Size.** L. **Decide.** Custom roles, per-user overrides, or both?

---

### 12. 10 to 12 website themes

**Ask.** 10 to 12 professionally designed themes, preview, pick one, the site changes automatically, layout included.

**Today. 🟡** Four presets (Atelier, Gold, Monochrome, Botanical) and a custom colour editor with a live preview and a contrast check; three fonts; corner size, density, picture shape, header layout. All of these change **colours and shape**; no preset changes the **layout**.

**Two readings** (please choose):
- **A. Colour and type themes** (same layout, 12 different looks): 8 more presets with colour sets, font pairs, corner and density choices, each with a screenshot thumbnail in the picker. Needs 2 to 4 more self-hosted fonts. Size **M**.
- **B. Full layout themes** (different header, home arrangement, card style, hero style): each theme is a bundle of the settings from item 3 (header variant, card style, category layout, section order) plus colours. This depends on item 3 existing first, and each layout variant is real design and test work. Size **XL**.

My suggestion: do **A** now (it is quick and satisfies "10–12 themes with preview"), and let B grow out of item 3's layout options so each theme can pick from them.

**Decide.** A, B, or A then B? Do you have reference sites for the look you want?

---

### 13. Order status emails

**Ask.** Emails when an order is booked, checked out, cancelled and dispatched; an ON/OFF switch for each; editable subject and text; order details in the message; sender address and mail settings; preview and test email; an email log (sent, failed, pending).

**Today. 🟡** When an order is placed, confirmed, dispatched, delivered, cancelled or returned, the system writes one message per event to a log table and, if a mail server is configured (`MAIL_URL`), sends it through SMTP; without a mail server it records the message as "skipped". The texts are fixed in the code (English). There is no admin screen for any of it, and the worker (item 5) must be running for anything to be sent.

**Gap and proposal.** A Settings → **Emails** screen: per event ON/OFF; subject and body templates with placeholders (`{{order.number}}`, `{{customer.name}}`, items, total, tracking link); preview with a sample order; **Send test email**; sender name and address and the mail server (kept in the secret settings, never shown after saving); a **delivery log** (sent, failed with the reason, pending, retry) with a link from the order page. Events are triggered by the order status changes that already exist.

**Size.** L. **Decide.**
- "Order booked" and "Order checkout completed" look like **one moment** in this shop (a guest places an order, there is no separate checkout payment for cash on delivery). Should they be one email, or is "booked" when staff **confirm** the order after calling the customer? We suggest: placed → "booked", staff confirm → "confirmed", dispatched, cancelled.
- Which mail service (own mailbox over SMTP, Gmail, Brevo, SendGrid)? Which sender address on rubaya.pk?
- Customers must have an email: today the email is **optional** at checkout. Make it required, or send only to those who gave one?

---

### 14. Delivery assignment, rider ledger and receipts (new)

**Ask (our reading).** After an order is placed and ready, **assign its delivery to a specific person** (a rider or delivery agent). Keep a **complete ledger** for that person. Record or generate **receipts**. Allow **bulk assignment**: select many orders and assign them to one person at once. Keep the full history of **assignment, delivery, ledger and receipt** for every transaction.

**Why this matters here.** The shop takes **cash on delivery**. Whoever delivers collects the customer's cash and later hands it to the shop. Without a ledger the shop cannot tell how much cash each rider is holding, which orders they have, which failed, and what they have paid in. That is exactly what this feature controls.

**Today. 🔴** An order can have a **courier company** (list in Settings → Shipping → Couriers) and a **tracking number**, set when staff mark it dispatched. There is no delivery *person*, no run or batch, no cash held by a rider, no ledger, no receipt other than the printable invoice and packing slip. Payments exist per order (cash collected is recorded by staff on the order).

**Proposed model** (for discussion):
- **Delivery person**: name, phone, type (employee, freelancer, or an agent of a courier company), active, optional fee per delivery or commission, optional login if they should use a phone screen.
- **Assignment** (a *run*, also called a manifest or sheet): one person, a date, a list of orders; status open, out, closed. Created from the Orders list by selecting rows and choosing **Assign to…** (that is the bulk assignment); a single order is the same with one row. A printable **delivery sheet** per run with the cash to collect.
- **Per order in a run**: assigned, out for delivery, delivered, failed (with a reason), returned. **Delivered** goes through the existing order status change (so stock, invoice and messages work as today); the assignment never changes an order's status by itself.
- **Ledger** per person, **append-only** (a mistake is corrected by a reversing entry, never by editing): *debit* the cash to collect when an order is handed over (or when delivered: see the decision below), *credit* cash handed in to the shop, *credit/debit* fees, deductions and adjustments, a running balance, an opening balance, and a statement by date range.
- **Receipts**, numbered from the same counters as orders: a **customer receipt** when the rider collects cash (printable or sent as a link on WhatsApp), and a **rider cash-deposit receipt** when the rider pays in (signed off by staff), plus a **fee payout receipt** if riders are paid per delivery. A receipt can be voided, never deleted.
- **History** of every transaction: who assigned it, when, to whom; each delivery attempt and result; each ledger entry with its source (order, deposit, adjustment); each receipt. Shown on the order page, on the person's page and in the audit log.
- **Permissions** (item 11): `deliveries:assign`, `deliveries:read`, `ledger:read`, `ledger:write` (deposits and adjustments), `receipts:void`.

**Where it fits.** It sits beside orders and payments and writes to neither's rules: order status still changes only in `changes.js`, the order's paid amount only through the payments module (collecting cash on delivery is recorded there), and the new ledger is its own table. Reports (cash outstanding by rider, deliveries per day) can come from the ledger.

**Size.** XL (data, API, admin screens, printable sheets and receipts, tests). **Decide** (these change the design):
1. **Who are the delivery people?** Own staff, freelancers, or the courier companies' riders? Do they need to log in on a phone to mark deliveries, or does staff do it for them?
2. **When does the rider owe the cash?** (a) The moment the order is handed to them (they carry the risk) or (b) when it is marked delivered. (a) is stricter and common for cash-heavy delivery.
3. **Money to riders:** a fee per delivery, a monthly salary, commission, or none? Are fuel or other expenses deducted?
4. **Failed and returned deliveries:** does the rider return the parcel and the debit reverses? Partial deliveries?
5. **Receipts:** what must they show (shop name, address, order number, amount, rider, signature, a QR code)? Printed, PDF, or sent by WhatsApp or email? Numbering format (for example `RC-000123`)?
6. **Cash handling:** day-end closing of each rider, a cash book for the shop, bank deposits? Or only the rider ledger for now?
7. **"Sales order":** we call these *Orders*. Is a fuller accounting side (invoices, customer ledger, tax) in scope, or only the rider ledger and receipts?
8. **Existing couriers** (TCS, Leopards ...): a courier company's rider is one case of a delivery person, or do we keep tracking numbers for them as today?

---

## 3. What I would do first (my suggestion, to discuss)

**Stage 1: the faults, about 2 to 3 days.** Item 5 (worker, upload fix, warning), item 8 (index rebuild, fallback, test), item 1 (the empty-category setting and the "why not shown" hint). These three clear most of what the owner has seen failing.

**Stage 2: the admin controls, about 2 weeks.** Items 7, 2 and 3 together (Subcategories, home sections with New in, category display and layouts, draft preview), then 6 (bulk delete) and 4 (notices).

**Stage 3: communication and access, about 2 weeks.** Item 13 (emails), item 11 (custom roles), item 12 (colour themes, A).

**Stage 4: the large pieces, after we agree the design.** Item 14 (delivery, ledger, receipts), item 9 (analytics), item 12 B (layout themes).

Items 10 needs only a walk-through.

## 4. Questions to settle before any of Stage 2 to 4

1. Empty categories on the shop: show them by default? (item 1)
2. Draft-and-publish for the home page, or save-then-look? (item 3)
3. Real delete or a trash that restores? (item 6)
4. Analytics: build, embed a ready-made tool, or both in turn; IP and consent choices. (item 9)
5. Custom roles, per-user overrides, or both? (item 11)
6. Themes: A, B, or A then B? (item 12)
7. Emails: which events, which mail service, is the customer's email required? (item 13)
8. Delivery: the eight questions in item 14.

## 6. Customers: visits, order history and highlight rules (built 2026-10-19)

The owner's second brief (Customer Management, Visit Tracking, Order History, Dynamic Highlight Settings). The Customers screens of M6-02 already had the list, the profile and the order history; what was new is below.

| Requirement | What was built | Where |
|---|---|---|
| Separate Customers tab with details, search, filter, sort | Already there (M6-02). Added columns **Customer since**, **Visits**, **Last visit** (sortable), and filters **Visits** and **Highlight** | `apps/admin/src/features/customers/` |
| Profile with complete order history | Already there (orders block on `/customers/:id`). Added the colour chips, "Customer since" and a **Website visits** block (visits, browsers, last visit, the last 10 pages) | same |
| Count visits per identifiable customer | A random number in the shop's own cookie (`nc_vid`, HttpOnly, one year) marks a browser. When that browser **places an order**, the order's link proves it, and the browser's visits (before and after) become the customer's. This is the one reliable link: a customer has no login | `apps/storefront/app/lib/visit.server.js`, `routes/visit.js`, `lib/visit.client.js`, `modules/visits/` |
| Anonymous visitors without guessing | Visits of a browser that never ordered stay anonymous and show only as totals (visits, visitors, new, returning, became customers) in the strip above the list. No visit is ever assigned to a customer by guesswork, address or fingerprint; nothing stores an address or a browser name | `admin.customers.visits` |
| Visit counts and order counts separate | Different columns, different filters, different rules (a rule counts either orders or visits) | `customers.visits_count` vs `orders_count` |
| Repeat visitors and repeat customers | Both are rules: "2 or more visits" (violet) and the order ranges. Filter "Visits: 2 or more" and "Highlight: <rule>" | |
| Highlight by order count, with configurable ranges and colours, nothing hardcoded | Rows in `customer_highlight_rules`, edited on `/customers/highlights`: add, edit, delete, from/up to, colour, name, on/off, for orders or for visits. The first four rules are seed data only | `modules/customers/highlights.js`, `highlight-rules-page.jsx` |
| Change at any time without code | Yes: saved in the database and applied at once to every list and profile | |

**Decisions made (change them if wrong):**
1. A visit is the first page of a stay that begins more than 30 minutes after the browser's last page; pages inside a stay do not count again.
2. A browser stays with the **first** customer who ordered from it (two people on one computer are not told apart). The alternative (move it to the latest buyer) would take history away from the first one.
3. Visits are counted only while **Store settings → Features → Count visits** is on (default on), and never for a browser that sends Do Not Track or Global Privacy Control, nor for robots. There is no cookie banner: the cookie holds a random number, nothing personal, and Pakistan has no cookie-consent law at this writing; add a notice if the owner's lawyer asks for one.
4. Overlapping ranges of one kind: the one that starts lower wins (ties: the older rule). The screen warns.
5. A customer who is anonymised loses their browsers and visits (the rows are deleted), so the website totals no longer include those visits.
6. Tracking needs JavaScript (a beacon); a visitor with scripts off is not counted. The shop itself works without scripts.

**Not built (not asked for, or needs the owner):** referrers, pages per visit, devices, countries (a fuller analytics tool: item 9 stays open); visit counts for customers who ordered before this change (their earlier visits were never recorded, so they start at the first visit after it).

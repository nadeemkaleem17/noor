# Glossary

| Field | Value |
|---|---|
| ID | DOC-GLOSSARY |
| Title | Domain and technical terms |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | — |
| Decisions used | ADR-0013, ADR-0014, ADR-0017, ADR-0020 |

## 1. Purpose and scope
One definition per term, used identically in every doc, code identifier and UI string. **Governs:** meaning of terms. **Does not govern:** how a term is implemented (see the doc named in "Where").

## 2. Specification

### 2.1 Domain terms
| Term | Definition | Where |
|---|---|---|
| Bridal | Premium made-to-order or limited-stock occasion wear; typically has deposits, long lead times and custom fitting | ADR-0014 |
| Bundle | A product `kind` that sells several child products together at one price; each child keeps its own stock check | ADR-0014 |
| Colorway | One colour treatment of a style, modelled as its own product with its own handle, gallery and SEO | ADR-0014 |
| Component | One physical piece inside a product (shirt, dupatta, trouser, shalwar, slip, lehnga, blouse, jacket, scarf, shoes, bag, other) with fabric, colour, technique and quantity. Not a UI component | contract `Component` |
| COD (cash on delivery) | Payment collected by the courier on delivery; the default method | ADR-0017 |
| COD confirmation | A human or WhatsApp check that a COD order is genuine before dispatch; orders wait in `pending_confirmation` | ADR-0017 |
| Custom size | Customer-supplied measurements captured against a product's form schema and stored on the order line as `customization` | ADR-0014 |
| Deposit | The part of a made-to-order price charged up front (`madeToOrder.depositPercent`); the rest is paid on delivery or by transfer | ADR-0014 |
| Drop | A scheduled release of a collection that causes traffic and stock spikes (lawn season, Eid) | ADR-0020 |
| Dupatta | The scarf/stole piece of a 3-piece suit; a `Component` type | — |
| Fit note | `runs_small`, `true_to_size` or `runs_large` shown on a product | contract `Fit` |
| Kind | Product class that drives behaviour: `stitched`, `unstitched`, `made_to_order`, `footwear`, `accessory`, `bundle`, `home`, `beauty` | ADR-0014 |
| Lawn | Light cotton fabric; the seasonal summer unstitched line that dominates the catalog | — |
| Lead time | Days from order to dispatch for made-to-order items (`minDays`–`maxDays`) | ADR-0014 |
| Made-to-order (MTO) | Product produced after the order; never has a counted stock quantity | ADR-0014 |
| Order number | Human-readable sequential number `RB-10001…`, from the `counters` table (MySQL has no sequences); not secret | ADR-0020 |
| Preorder | Item sold before stock arrives; has an expected date, no counted stock | ADR-0014 |
| Roman Urdu | Urdu written in Latin letters; common in search queries; handled as search synonyms, not as a locale | ADR-0010 |
| Shalwar kameez | Traditional outfit (kameez = shirt, shalwar = trouser); a stitched or unstitched product | — |
| Size chart | Measurement tables for a product (`SizeChart`), in inches or cm | contract `SizeChart` |
| Size system | Ordered list of size labels (XS…XXL, EU shoe sizes); a product's size option points to one | contract `SizeSystem` |
| Stitched | Ready-to-wear item sold by size | ADR-0014 |
| Style | A design shared by several colorways (`styleId`) | ADR-0014 |
| Tracking token | Unguessable string in the confirmation link and WhatsApp message that lets a customer view an order without typing a phone number | ADR-0012 |
| Unstitched | Fabric sold as a set to be tailored; sold per set with `components[]`, no size chart | ADR-0014 |
| Wishlist | Saved products for a browser (and later an account) | DOC-06 |
| WhatsApp link | `https://wa.me/<digits>?text=…` link; number in E.164 digits without `+` | DOC-06 |
| Zone (shipping) | A named set of cities with delivery methods, fees, free-shipping thresholds and ETAs | DOC-09 |

### 2.2 Commerce and money terms
| Term | Definition | Where |
|---|---|---|
| Basis points (bps) | 1/100 of a percent; 12.5% = 1250 bps; used for percentage maths | ADR-0013 |
| Cart (server) | The persisted basket whose totals are computed by the API | ADR-0020 |
| Idempotency key | Client-generated UUID sent with an order-creating request so retries replay one result | ADR-0020 |
| Invoice number | `INV-<year>-<6 digits>` from a per-year row in the `counters` table, assigned at first dispatch | ADR-0020 |
| Minor unit / paisa | 1/100 of a rupee; all stored and transmitted amounts are integer paisa | ADR-0013 |
| Money | `{ amount: integer paisa, currency: "PKR" }` | ADR-0013 |
| Order status | `pending`, `pending_confirmation`, `confirmed`, `dispatched`, `delivered`, `cancelled`, `returned`; changes only through the transition table | DOC-09.7 §5.1 |
| Payment status (order) | `unpaid`, `deposit_paid`, `paid`, `refund_due`, `partially_refunded`, `refunded`; derived from the order's payment rows | DOC-09.7 §5.3 |
| Payment state (one payment) | `initiated`, `pending_confirmation`, `authorized`, `captured`, `failed`, `expired`, `refunded` | DOC-09.7 §5.2 |
| Movement (inventory) | See Inventory movement | DOC-09.4 |
| Snapshot | A copy of a value (title, price, address, label) stored on the order so later edits elsewhere never change it | DOC-09.0 §2 |
| Settings document | One validated JSON value in the `settings` table (`store`, `theme`, `home`, `payments`, `checkout`) | DOC-09.9 §2 |
| Payment session | A provider-specific attempt to collect money for an order | ADR-0017 |
| PKR | Pakistani rupee; the only currency in v1 | ADR-0001 |
| Reservation | Stock held for an order between creation and dispatch or expiry | ADR-0020 |
| Server-priced | Totals, discounts and shipping are computed by the API, never accepted from a client | ADR-0020 |
| SKU | Merchant stock-keeping code of one variant, unique | DOC-09 |
| Variant | A buyable combination of option values (e.g., size M) with its own SKU, price and stock | ADR-0014 |

### 2.3 Technical terms
| Term | Definition | Where |
|---|---|---|
| ADR | Architecture decision record: one decision, options, consequences, revisit trigger | DOC-02 |
| Admin panel | The staff web app (`apps/admin`) | DOC-07 |
| Audit log | Append-only record of every admin mutation (actor, entity, diff) | ADR-0012 |
| BFF (backend for frontend) | The storefront server that calls the API on behalf of the browser | ADR-0004 |
| CDN | Network that caches public responses close to users | ADR-0004 |
| Contract (package) | `packages/contract`: Zod schemas, route table and money helpers shared by all apps | ADR-0005 |
| Facet | A filter group on a listing (fabric, colour) with live counts | ADR-0010 |
| Framework mode | React Router's full-stack mode with `routes.ts`, loaders, SSR and pre-render | ADR-0004 |
| Handle | URL-safe unique slug of a product, category or collection | DOC-06 |
| Logical property | CSS that uses start/end instead of left/right so layouts mirror in RTL | ADR-0006 |
| Module (backend) | A folder under `apps/api/src/modules` with a public `index.ts`; the only legal import target between modules | ADR-0016 |
| Outbox | Table of domain events written in the same transaction as the change that caused them | ADR-0009 |
| Prerender | Generating HTML at build time for static pages | ADR-0004 |
| Primitive token | Raw design value (a grey, a spacing step); never used directly in components | ADR-0006 |
| RBAC | Role-based access control: roles hold `resource:action` permissions | ADR-0012 |
| Route table | The typed map in the contract of every endpoint (method, path, auth, schemas) | ADR-0005 |
| RTL | Right-to-left layout, needed for Urdu | ADR-0018 |
| Semantic token | Role-named design value a component uses (`--color-fg`, `--color-accent`) | ADR-0006 |
| SSR | Rendering HTML on the server per request | ADR-0004 |
| State machine | Defined set of states and allowed transitions, stored as a table | DOC-09 |
| Storefront | The customer web app (`apps/storefront`) | DOC-06 |
| Bulk result | The per-item outcome of a bulk action: `succeeded[]` and `failed[]` with a stable code each | DOC-07.14 §5 |
| Confirmation attempt | A logged try to reach a COD customer (channel, outcome) before confirming the order | DOC-07.5 §5.1 |
| Inventory movement | A recorded stock change with a quantity delta and a reason; the only way stock changes | DOC-07.3 §7.1 |
| Permission | A `resource:action` string (e.g. `orders:dispatch`) held by a role; the UI and API check permissions, never role names | DOC-07.1 §2 |
| Risk marker | An informational chip on an order (refused before, duplicate suspect, high value, COD blocked); never blocks by itself | DOC-07.5 §5.3 |
| Stale write | A save rejected with `409 stale_write` because the record changed since it was loaded (`version` mismatch) | DOC-07.3 §9 |
| Step-up | Re-entering the password before a sensitive action when the session is older than 15 minutes | DOC-07.12 §4 |
| Dead letter | A job that failed its maximum attempts and was moved aside for staff attention | DOC-08 §9 |
| Expand / contract | Shipping a breaking schema change in three compatible steps: add, backfill, remove | DOC-14 §5.1 |
| Internal key | The shared secret the storefront server sends to the API so the API trusts its forwarded client IP | DOC-11 §2 |
| Job | A unit of background work stored in the `jobs` table and run by the worker | DOC-08 §9 |
| Pending session | The 5-minute session between a correct password and a correct 2FA code | DOC-11 §3.4 |
| Tag (cache) | A label on a cached response used to purge related pages together (`product:<handle>`) | DOC-08 §10 |
| Auth class | How a route identifies its caller: `public`, `cart`, `order-token`, `staff`, `staff-pending`, `webhook` | DOC-10.0 §3 |
| Problem (error) | An RFC 9457 `application/problem+json` error body with a stable `code` | DOC-10.0 §6 |
| Route key | The name of an endpoint in the contract route table (`catalog.listProducts`) | DOC-10.0 §2 |
| Adapter | A module-internal implementation of a provider interface (payment provider, notification channel, courier) | DOC-12 §2 |
| IPN | Easypaisa's name for its payment webhook (Instant Payment Notification) | DOC-12 §3.4 |
| Mask (SMS) | A branded sender name registered with the PTA, shown instead of a number | DOC-12 §4.2 |
| Service window (WhatsApp) | The 24 hours after a customer messages a business, during which replies and utility templates are free | DOC-12 §4.2 |
| Template (message) | A fixed message text with named variables, one per locale; the only form in which customer messages are sent | DOC-12 §4.4 |
| CSP | Content Security Policy: the response header listing which scripts, styles and hosts a page may load | DOC-11 §5.3 |
| CSRF | Cross-site request forgery: a forged request riding on a signed-in user's cookie; blocked by origin and token checks | DOC-11 §5.1 |
| E.164 | International phone format `+923001234567`; how every phone number is stored | DOC-09.7 §2.1 |
| LQIP | Low-quality image placeholder: a tiny blurred image shown until the real one loads | DOC-08 §11 |
| PDP | Product detail page (`/p/:handle`) | DOC-06.4 |
| PLP | Product listing page (category, collection, search) | DOC-06.3 |
| TOTP | Time-based one-time password: the 6-digit code from an authenticator app | DOC-11 §3.3 |
| Webhook | Provider-to-us HTTP callback reporting an event; verified, stored and processed idempotently | ADR-0017 |
| Cache class | One of L (listing/detail), S (static content), P (private), R (resource): the `Cache-Control` policy of a storefront route | DOC-06.1 §2 |
| OrderPublic | The masked order shape the storefront receives; never contains full phone, address or internal notes | DOC-06.6 §4.1 |
| ProductSummary | The compact product shape returned by listings and used by `ProductCard` | DOC-06.3 §3 |
| Reference profile | Mid-range Android (4× CPU slowdown) on Slow 4G; the device/network every performance budget is measured on | DOC-06.10 §1 |
| Action (route) | React Router function that handles a form submission or mutation on the storefront server | DOC-03 §7 |
| Brand (theme) | The set of semantic token values for an app or store: `admin-burgundy`, or a storefront `ThemeTokens` object | DOC-04a |
| Contrast gate | The script that fails CI when a token pair is below its WCAG ratio | DOC-04a §9 |
| Deferred data | Loader data returned as a promise and streamed after the first HTML | DOC-05 §7 |
| Feature (frontend) | A folder under `features/` owning one business area; features never import each other | DOC-03 §5 |
| Loader | React Router function that fetches a route’s data on the storefront server | DOC-03 §7 |
| Preset (theme) | A built-in storefront `ThemeTokens` object: `storefront-gold`, `monochrome`, `botanical` | DOC-04a §4.2 |
| Query key | The array that identifies cached server data in TanStack Query; produced only by a feature’s key factory | DOC-05 §10 |

## 3. Rules
**Always:** reuse these terms in identifiers (`colorway`, `reservation`, `paisa`). **Never:** use "component" for a garment piece in code outside the `Component` contract type; use "price" for a float. **Common mistake:** calling the order number a secret; it is public, the `tracking_token` is the secret.

## 4. Acceptance checklist
- [ ] Every domain/technical term introduced in a new doc is added here in the same PR. **A rule for authors, kept per change; not a state.**
- [ ] No term has two definitions across docs. **A rule for authors, kept per change; not a state.**

## 5. Open questions and assumptions
Order and payment status sets are provisional until DOC-09 (Phase 5); Phase 7 reconciles them.

## 6. Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Initial glossary (Phase 0) |
| 2026-10-02 | Phase 1: added Action, Brand, Contrast gate, Deferred data, Feature, Loader, Preset, Query key |
| 2026-10-02 | Phase 2: added Cache class, OrderPublic, ProductSummary, Reference profile |
| 2026-10-02 | Phase 3: added Bulk result, Confirmation attempt, Inventory movement, Permission, Risk marker, Stale write, Step-up |
| 2026-10-02 | Phase 4: added Dead letter, Expand / contract, Internal key, Job, Pending session, Tag (cache) |
| 2026-10-02 | Phase 5 part 1: order and payment status sets made final (no longer provisional); added Payment state, Snapshot, Settings document |
| 2026-10-02 | Phase 5 part 2: added Auth class, Problem, Route key |
| 2026-10-02 | Phase 5 part 3: added Adapter, IPN, Mask, Service window, Template |
| 2026-10-02 | Phase 7 consistency review: kind value fixed; added CSP, CSRF, E.164, LQIP, PDP, PLP, TOTP. Spelling rule: prose says "colourway", code and identifiers say `colorway` |

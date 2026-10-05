# 07.13 — Admin: Audit Log

| Field | Value |
|---|---|
| ID | DOC-07.13 |
| Title | Audit log screen and embedded history panels |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.14 |
| Decisions used | ADR-0009, ADR-0012 |

## 1. Purpose and scope

**Governs:** `/audit` and the "History" panels embedded in product, order, customer, promo and settings screens.
**Does not govern:** what is written to the log and how (ADR-0012: every admin mutation writes `audit_log` in the same transaction; DOC-09, DOC-11); order timelines (`order_events`, DOC-07.5), which are a separate, customer-relevant record.

Needs `audit:read` (owner and manager by default). Read-only: there is no edit or delete anywhere in this UI or the API.

## 2. List (`/audit`)

Newest first, server-paginated by cursor (page size 50), virtualized body.

| Column | Content |
|---|---|
| Time | Absolute, Asia/Karachi, to the second |
| Actor | Staff name (link to `/staff/:id`), or `system` (jobs), or `storefront` (customer-initiated, e.g. order cancelled by token) |
| Action | Human sentence from the action code: "updated product", "confirmed order", "changed role", "exported customers", "signed in", "failed sign-in" |
| Entity | Type + label with a link: `Product · Embroidered Lawn 3-Piece`, `Order · RB-10458`, `Staff · a.khan@…` |
| Summary | First changed fields: `price 6,990 → 7,490; status draft → active` |
| IP | Address (full for owners; last octet masked for managers) |

Filters (URL): `actor`, `entityType` (product, variant/inventory, category, collection, attribute, size chart, order, customer, promo, review, page, menu, home content, settings, shipping, payments, staff, session, export, job), `entityId`, `action`, `from`/`to`, `q` (entity label, order number, SKU). Presets: "Security" (sign-ins, failures, 2FA changes, role changes, session revocations), "Money" (price, promo, shipping, payment-setting changes, manual payments, refunds), "Failed jobs" (`type=job_failed`, linked from the dashboard).

## 3. Entry detail (drawer, `?entry=<id>`)

| Section | Content |
|---|---|
| Header | Action sentence, time, actor, role at the time, IP, browser (parsed user agent), request id (for matching server logs, DOC-13) |
| Changes | A two-column **before → after** table of changed fields only. Money as formatted rupees with the raw paisa in a tooltip; long text as an inline word diff; arrays as added/removed chips; images as thumbnails |
| Context | Reason or note supplied with the action (cancel reason, stock adjustment reason, COD override reason) |
| Links | Open the entity; "All activity for this entity"; "All activity by this person" |

Redaction (done by the API, shown as `•••`): passwords, password hashes, TOTP secrets, recovery codes, session ids, tokens, provider credentials. Customer phone and address changes show masked values unless the viewer has `customers:read`.

## 4. Embedded history panels

A collapsed "History" card on entity screens lists the 10 newest audit entries for that entity (`admin.audit.list?entityType&entityId&limit=10`) with "View all" linking to `/audit` pre-filtered. Shown only to users with `audit:read`. Used on: product editor, order detail (in addition to the timeline), customer detail, promo drawer, each settings card.

## 5. Retention and export

| Rule | Detail |
|---|---|
| Retention | Entries are kept 24 months, then deleted by a monthly job; security and money presets are kept 36 months (values owned by DOC-11; shown as a note on this screen) |
| Export | "Export CSV" of the current filter (max 10,000 rows, owner only); the export itself is an audit entry |
| Tamper resistance | The UI offers no mutation; the API has no update/delete route for audit entries; database-level protection is DOC-11's concern |

## 6. Rules

**Always:** link every entry to its entity and actor; show only changed fields; record exports of personal data.
**Never:** show secrets or full credentials in a diff; allow editing or deleting entries; use the audit log as the customer-visible order history.
**Common mistakes:** logging the entire entity instead of the diff; an audit entry with no way to find the entity; treating `system` actions as unowned (they carry the job name and the triggering entry).

## 7. Acceptance checklist

- [x] Changing a product price creates one entry whose detail shows `price` before and after and nothing unrelated. (Entries of real product saves show only the changed fields; `audit.test.jsx` shows money as rupees with the paisa on hover.)
- [x] A failed sign-in appears under the Security preset with the email attempted and the IP, and no password. (Seen in the browser: category `security`, the email tried, the IP; no password.)
- [ ] A role change entry shows old and new role, actor and target. (The server writes `staff.role_changed` with the diff; not yet looked at in the browser.)
- [x] No request from the admin can modify or delete an audit entry (API has no such route; test asserts 404/405). (Append-only at the database and no route, M1-03; the screen has no control.)
- [x] A user without `audit:read` sees no History cards and gets the 403 state on `/audit`. (`audit.test.jsx`.)
- [x] Filters and the open entry restore from the URL. (`audit.test.jsx`.)

## 8. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.13-1 | Action codes and entity types | Defined in DOC-09 (`audit_log`) and DOC-11 | DOC-09/DOC-11 |
| Q-07.13-2 | Retention periods | 24 / 36 months | DOC-11 or legal advice |
| Q-07.13-3 | Read access (viewing customer records) | Not logged in v1; only mutations, sign-ins and exports | A privacy requirement to log reads |

## 9. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |
| 2026-10-05 | M3-07 built (`features/audit`, `components/history-panel.jsx`): list newest first with a "Load more" (cursor) instead of a virtualised body (see DOC-07.14), presets Everything / Security / Money, kind-of-thing, date range and search filters in the address, entry drawer (`?entry=`) with before and after, History panels on product, page, collection and the store, appearance and payments settings. Not built: the "Failed jobs" preset (no job entries yet), export CSV (waits for exports, M4-10), word diff of long text and thumbnails for images (values show as text), History cards on order, customer and promo screens (those screens come in M4) |

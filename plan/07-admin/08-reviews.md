# 07.8 — Admin: Reviews

| Field | Value |
|---|---|
| ID | DOC-07.8 |
| Title | Review moderation and replies |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.14, DOC-06.4 §9, DOC-06.6 §6 |
| Decisions used | ADR-0011, ADR-0012 |

## 1. Purpose and scope

**Governs:** `/reviews`: the moderation queue and store replies. Shown in the sidebar only when `StoreConfig.features.reviews` is on.
**Does not govern:** how customers submit reviews (DOC-06.6 §6); how ratings are displayed (DOC-06.4 §9).

Reviews come only from delivered order lines (verified purchase), start as `pending`, and appear on the storefront only when `approved`.

## 2. Queue

Tabs: **Pending** (default, oldest first), **Approved**, **Rejected**, **All**.

| Column | Content |
|---|---|
| ☐ | Selection |
| Review | Stars, title, first 140 characters of the body, photo thumbnails |
| Product | Thumbnail + title (link to the product) |
| Author | Display name; link to the order (`RB-…`) |
| Fit | Runs small / true to size / runs large |
| Date | Submitted |
| Status | `StatusBadge` |
| Actions | Approve, Reject (inline buttons on pending rows) |

Filters: `q` (text, product, order number), `rating`, `product`, `hasPhotos`, `status`. Bulk: Approve, Reject (needs `reviews:moderate`).

## 3. Review drawer (`?review=<id>`)

| Section | Content |
|---|---|
| Review | Full text, stars, fit, photos (click to enlarge), submitted date, order link, product link |
| Decision | **Approve** / **Reject**. Reject requires a reason: `offensive`, `personal_data`, `not_about_product`, `spam`, `other` (+ note). The reason is internal |
| Photos | Each photo can be removed individually before approving (e.g. it shows a face or an address label) |
| Store reply | `Textarea` ≤ 600, public, shown under the review with the store name; one reply per review; editable; saved with the staff member recorded in the audit log, not shown publicly |
| History | Status changes with actor and time |

| Rule | Detail |
|---|---|
| Editing | Staff cannot edit the customer's text or rating. They approve, reject, or remove photos |
| Re-moderation | An approved review can be rejected later (and the reverse); the storefront rating recalculates |
| Effect on the storefront | Approve/reject purges the product's cache tag; the product's average and count are maintained by the API |
| Low ratings | Rejecting solely because a rating is low is against the guideline shown in the drawer ("Reject only for the listed reasons"); every rejection carries its reason in the audit log |
| Personal data | If a review contains a phone number or address, reject with `personal_data` |

## 4. Rules

**Always:** record a reason for a rejection; keep the reply polite and specific; check photos before approving.
**Never:** edit a customer's words or stars; create reviews in the admin; expose the reviewer's phone or full name (display name only).
**Common mistakes:** approving in bulk without opening photo reviews; replying with customer order details.

## 5. Acceptance checklist

- [ ] A submitted review is invisible on the storefront until approved, and visible within the cache window after.
- [ ] Reject without a reason is impossible.
- [ ] Removing one photo then approving publishes the review without that photo.
- [ ] Rejecting an approved review lowers the product's review count.
- [ ] With `features.reviews` off, `/reviews` is absent from the sidebar and returns the not-found state.

## 6. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.8-1 | Review photos storage and size limits | Same pipeline as product media, ≤ 5 MB, max 3 | DOC-10 reviews |
| Q-07.8-2 | Notifying the customer of a reply | Not in v1 | DOC-12 templates added |
| Q-07.8-3 | Rejection reason codes | As §3 | DOC-09 |

## 7. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |

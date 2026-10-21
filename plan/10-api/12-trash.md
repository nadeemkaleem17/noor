# 10.12 — API: The trash

| Field | Value |
|---|---|
| ID | DOC-10.12 |
| Title | Trash for deleted records (30 days, put back) |
| Status | Built 2026-10-21 (plan/17 item 6; the owner asked for it on 2026-10-21) |
| Depends on | DOC-10.5 (catalog), DOC-10.7 (content), promotions |

A delete stays a real delete: the shop no longer lists, searches or sells the record, and foreign keys are free. What stays is a **copy of what the record was made from** (the same words `create` takes), in table `trash_items` (migration `0031`), for 30 days.

## 1. The rules

1. **Six kinds**: product, category (includes subcategories), attribute, collection, promo code, page. Every delete path of these kinds, single or in bulk, is wrapped by `trash.guard` in `createServices`, so none can skip it. The copy is read before the delete and written after it succeeded: a delete that is refused (`in_use`) keeps nothing; a copy that cannot be written is logged and never undoes the delete.
2. **A restore is a create again** (a new id, the same words) through the same service, with every rule of a create checked as new. If it cannot be done (a handle or slug taken since, a category that was deleted, an invalid reference) the answer says why and the copy stays in the trash. A product comes back as a **draft**, never live by itself. (A product with orders or stock history cannot be deleted at all, so there is no stock to bring back.)
3. **Permissions**: a person sees and restores only the kinds they may write (`products:write`, `catalog:write`, `promos:write`, `content:write`) and empties only the kinds they may delete (`*:delete`). The routes are `staff-any`; the kind decides.
4. **30 days**, then not listed, not restorable, and removed by the nightly job `trash.cleanup` (restored copies a week after their restore). `pickInput` (`platform/pick-input.js`) keeps what the kind's input schema names, all the way down, so a copy is exactly what `create` takes.
5. Not kept: orders, customers, reviews, couriers, delivery records, size charts and forms (their deletes are blocked while used, or they are records the shop must keep).

## 2. Routes

| Key | Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `admin.trash.list` | `GET /admin/trash` | any signed-in staff (filtered by kind) | — | 200 `{ items: { id, kind, label, deletedAt, deletedBy?, expiresAt }[] }`, newest first, at most 500 | — |
| `admin.trash.restore` | `POST /admin/trash/:id/restore` | staff, the kind's write permission | — | 200 `{ kind, id, label }` (the new record) | `forbidden`, `not_found` (gone, restored or expired), and whatever a create refuses |
| `admin.trash.purge` | `DELETE /admin/trash/:id` | staff, the kind's delete permission | — | 204 | `forbidden`, `not_found` |

Audit: `trash.restored` (the restored record) and `trash.purged`; the delete itself is audited by its own service as before.

## 3. In the admin

**Settings > Trash** (`/trash`): each item with its kind, who deleted it and when, how many days it is kept, **Put back** and **Delete now** (after a question). A restore that fails shows the reason under the item. Every delete dialog says "It stays in the Trash for 30 days, so it can be put back."

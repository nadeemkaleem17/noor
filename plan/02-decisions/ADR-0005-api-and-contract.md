# ADR-0005 — REST + OpenAPI with one Zod 4 contract package

| Field | Value |
|---|---|
| ID | ADR-0005 |
| Title | API style and contract |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K2, F-14, F-15), ADR-0002, ADR-0003 |
| Decisions used | ADR-0013, ADR-0016 |

## Purpose and scope
API style, contract ownership, validation and versioning rule. Endpoint lists are DOC-10; error and pagination conventions are `10-api/conventions.md`.

## Context
The contract exists in three drifting forms (K2). Zod 3 is used today (admin ^3.24.1, mock ^3.25.76, F-15). Zod 4 is stable; its package root exports v4; `@hookform/resolvers` ≥ 5.1.0 supports Zod 4 (DOC-02 §4).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. REST + OpenAPI generated from Zod | Cacheable GETs (CDN), simple clients, tool-friendly for agents, third parties can integrate | Route table must be maintained |
| B. GraphQL | Flexible reads | Harder CDN caching; resolver/N+1 discipline; extra stack for a small team |
| C. Typed RPC (tRPC-style) | Least boilerplate | Couples clients to server code; weak for public/third-party and CDN-cacheable reads |

## Decision
**Option A.**
- One package, `packages/contract`, written in **Zod 4** (`import { z } from "zod"`): entity schemas, request/response schemas, and a **route table**:
```ts
export const routes = {
  "catalog.listProducts": { method: "GET", path: "/api/v1/products", auth: "public",
    query: ListProductsQuery, response: Page(ProductSummary) },
  "orders.create": { method: "POST", path: "/api/v1/orders", auth: "public", idempotent: true,
    body: CreateOrderBody, response: OrderPublic },
} as const;
```
- Server registers handlers from the table and validates request input in every environment; validates responses in dev/test only. Storefront and admin call a typed client built from the same table.
- OpenAPI 3.1 is generated from the table (`z.toJSONSchema`) in CI and published as an artifact; hand-edited OpenAPI is forbidden.
- Versioning: path prefix `/api/v1`. Breaking change = new prefix; additive changes are not breaking.
- Money in JSON is `{ "amount": <int paisa>, "currency": "PKR" }` (ADR-0013).
- All admin routes live under `/api/v1/admin/*`; public under `/api/v1/*`.
- Error format: RFC 9457 `application/problem+json` with a stable `code` (DOC-10 conventions), replacing today's ad hoc `{error, issues}` (F-14).
- Migrating from Zod 3: run the official codemod `npx zod-v3-to-v4`, then fix `.email()`→`z.email()` style changes by hand; use `@hookform/resolvers` ≥ 5.1.0.

## Examples
`packages/contract/src/money.ts`:
```ts
import { z } from "zod";
export const Money = z.object({ amount: z.number().int().safe(), currency: z.literal("PKR") });
export type Money = z.infer<typeof Money>;
```

## Consequences
One source of truth; drift (K2) becomes a compile error. Contract package changes ripple to all apps, which is the point. The v1 contract is PKR-only (multi-currency is on the cut list, ADR-0001).

## Rules
**Always:** add the route to the table first, then the handler, then the client call. **Never:** define a request/response shape inside an app; return a bare string error. **Common mistake:** adding a field to the DB and forgetting the contract (response validation in tests catches it).

## Acceptance checklist
- [ ] `packages/contract` has no dependency except `zod`.
- [ ] CI regenerates OpenAPI and fails on diff against the committed snapshot.
- [ ] No app imports `zod` schemas that duplicate a contract schema.

## Revisit trigger
Reconsider GraphQL if three or more distinct client apps with very different read shapes appear; reconsider RPC if no third-party consumer exists after 12 months and CDN caching of GETs is not used.

## Open questions and assumptions
The implementation helper (hand-rolled route table vs a library) is decided in DOC-08 after a spike; the *contract shape above* is the fixed part. Zod 4 `z.toJSONSchema` availability is taken from secondary skill docs and must be confirmed against zod.dev during M0.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Phase 4: route helper decided: `fastify-type-provider-zod` + a small registrar; OpenAPI via `@fastify/swagger` (DOC-08 §6.1) |
| 2026-10-02 | Phase 5: conventions (errors, pagination, idempotency, bulk, auth classes) in DOC-10.0; endpoints in DOC-10.1 … 10.8 |

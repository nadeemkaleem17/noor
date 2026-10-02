# ADR-0016 — Fastify 5 modular monolith with enforced module boundaries

| Field | Value |
|---|---|
| ID | ADR-0016 |
| Title | Backend framework and module architecture |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | ADR-0001, ADR-0002, ADR-0005, ADR-0008 |
| Decisions used | ADR-0009, ADR-0012, ADR-0020 |

## Purpose and scope
HTTP framework and internal structure of `apps/api`. Layering rules and module list are DOC-08.

## Context
The mock is a single 212-line `server.js` on Express 5 with module-level mutable arrays (`server.js:9-16`). The real backend needs plugin-style cross-cutting concerns (auth, rate limit, request ids, validation, logging) and enforced separation between commerce modules (ADR-0001).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Fastify 5 | Plugin encapsulation, hooks, built-in structured logging (pino), mature rate-limit/helmet/cookie plugins, schema-first | Smaller mind-share than Express |
| B. Express 5 | Team already knows it (the mock) | Few built-in guardrails; validation/logging by convention |
| C. Hono | Light, portable | Node-server ecosystem for cookies/sessions/rate-limit less established for us |
| D. NestJS | Opinionated modules, DI | Heavy, decorator-based; slower for agents to reason about; Angular-style learning curve |

## Decision
**Option A**, with a **hand-rolled module convention** (no DI framework):
```
apps/api/src/
  app.ts            // builds Fastify, registers plugins, mounts routes from the contract route table
  modules/<name>/
    index.ts        // PUBLIC API: functions + types other modules may use
    routes.ts       // thin: parse → call service → map to contract
    service.ts      // business rules, transactions
    repository.ts   // the only file that touches Drizzle
    events.ts       // event names + payload schemas this module emits/handles
    *.test.ts
  platform/         // db, logger, config, session, outbox, errors (no business rules)
```
- **Layering:** `routes → service → repository`; services call other modules **only** through their `index.ts`. ESLint `no-restricted-imports` (patterns `modules/*/!(index)`) enforces it; a dependency-cruiser check runs in CI.
- **Config:** one `config.ts` that parses `process.env` with Zod at boot and exits on failure; no `process.env` elsewhere.
- **Errors:** modules throw typed `DomainError(code, status, details)`; one error handler renders RFC 9457 problems (DOC-10).
- **Logging:** pino JSON, request id on every line, PII redaction list (phone, address, email).
- **Transactions:** `service` opens `db.transaction`; `repository` functions accept a `tx`.

## Examples
```ts
// modules/orders/index.ts  (public)
export { createOrder, getOrderForCustomer } from "./service";
export type { OrderSnapshot } from "./types";
```

## Consequences
Clear places for code and reviews; agents can follow a fixed template. Fastify's plugin model must be learned.

## Rules
**Always:** keep routes thin; return contract types. **Never:** import another module's `repository.ts`/`service.ts`; read `process.env` outside `config.ts`; log request bodies. **Common mistake:** adding "just one query" to a route handler.

## Acceptance checklist
- [ ] CI dependency-cruiser passes with the module rules.
- [ ] App fails fast on invalid config (test).
- [ ] Every route is registered from the contract route table; an unregistered route is a test failure.

## Revisit trigger
A module needs independent scaling or deployment (extract it behind its `index.ts`), or Fastify maintenance stalls.

## Open questions and assumptions
Fastify 5 plugin versions and Zod 4 type-provider support were **not researched**; DOC-08 includes a 1-day spike on the route-table-to-Fastify adapter (ADR-0005).

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Phase 4: versions pinned; module list, dependency edges and request lifecycle specified in DOC-08 |

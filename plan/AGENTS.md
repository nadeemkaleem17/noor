# AGENTS.md — Rules for AI coding agents

| Field | Value |
|---|---|
| ID | DOC-AGENTS |
| Title | Stack, commands, folder rules, do/don't, definition of done |
| Status | Draft (first version; extended in Phases 4–6) |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-03, DOC-04a/b/c, DOC-05, DOC-15 |
| Decisions used | ADR-0001 … ADR-0020 |

## 1. Purpose and scope

The short operating manual for any AI agent (Claude Code or other) working in this repository. It states rules and points to the doc that owns each one; it does not restate specifications. If this file and a numbered doc disagree, the numbered doc wins and this file gets fixed in the same PR.

The root `CLAUDE.md` links here. Read this file first, then **only the docs your task cites**. The set is large; do not read it whole.

## 2. How to find what you need

| You are about to… | Read |
|---|---|
| Touch anything | This file |
| Add or move a frontend file | DOC-03 §5 |
| Fetch or mutate data | DOC-03 §7, DOC-05 §10 (admin) or §7/§9 (storefront) |
| Build or change a UI component | DOC-04b; tokens DOC-04a |
| Build a form, table, overlay, empty/loading/error state | DOC-04c, DOC-05 §3 |
| Build a storefront page | DOC-06 file for that area |
| Build an admin page | DOC-07 file for that area; every list uses `DataTable` (DOC-07.14); permissions via `useCan` (DOC-07.1) |
| Add or change an endpoint | DOC-10.0 (conventions, error codes) + the DOC-10 file for that area; ADR-0005. Contract route table first |
| Add or change a table | DOC-09.0 (conventions) + the DOC-09 file for that module; ADR-0008 |
| Change an order or payment status, or stock | DOC-09.7 §5 (transition tables), DOC-09.4 §3 (inventory operations). No other code path may write these |
| Compute a price, discount, shipping fee or deposit | DOC-09.6 §4 (the one implementation) |
| Call or add any external service (payments, messaging, couriers, analytics) | DOC-12. Launch needs none; complete DOC-12 §8 before writing an adapter |
| Touch cart, pricing, promos, stock or orders | ADR-0013, ADR-0020 (mandatory), DOC-01 §4.1 |
| Touch auth, sessions, roles, headers, rate limits, personal data | ADR-0012, DOC-11 |
| Add or change a backend module, event or job | DOC-08 §5, §8, §9 |
| Set up locally, change config, write a migration, seed data | DOC-14 §3–5 |
| Name something, open a PR | DOC-15 |
| Pick the next task, or check what a task must deliver | DOC-16 §5 (backlog), §7 (working agreement) |
| Write or place a test, check a budget or gate | DOC-13 |
| Understand a term | GLOSSARY |
| Know why something is the way it is | `02-decisions/README.md` → the ADR |

Docs not yet written are listed in `plan/README.md` §3. **If the doc your task needs is "Not started", stop and say so; do not invent the specification in code.**

## 3. Stack (summary; versions in DOC-03 §2)

| Layer | Choice |
|---|---|
| Language | **JavaScript with JSDoc types** (ADR-0021). No .ts/.tsx; `tsc --checkJs` is the typecheck. Read `.ts` in other docs as `.js`, `.tsx` as `.jsx` |
| Repo | pnpm workspaces + Turborepo: `apps/{api,admin,storefront}`, `packages/{contract,ui,i18n,config}` |
| Backend | Node.js 22, Fastify 5 modular monolith (ADR-0016) |
| Database | MySQL 8.4 + Drizzle ORM, `mysql2` driver (ADR-0008) |
| Contract | One Zod 4 package, REST under `/api/v1`, OpenAPI generated (ADR-0005) |
| Storefront | React 19, React Router 8 framework mode, SSR (ADR-0004) |
| Admin | React 19 SPA on Vite 8; TanStack Query, Table, Virtual (ADR-0015) |
| UI | `@noor/ui`: owned components on Base UI, Tailwind v4, semantic tokens (ADR-0006, 0007) |
| Forms | React Hook Form + Zod resolver |
| i18n | i18next; English now, Urdu/RTL-ready (ADR-0018) |
| Tests | Vitest; Storybook 10 for components; Playwright for end-to-end (DOC-13) |

## 4. Commands

Run from the repo root.

| Command | Use |
|---|---|
| `pnpm install` | After pulling |
| `pnpm dev` | API :3000, admin :5173, storefront :5174 |
| `pnpm --filter @noor/<name> <script>` | One workspace (`@noor/api`, `@noor/admin`, `@noor/storefront`, `@noor/ui`, `@noor/contract`) |
| `pnpm storybook` | Component workshop :6006 |
| `pnpm check` | Typecheck + lint + test + logical-properties scan. **Must pass before you say a task is done** |
| `pnpm test:integration` / `pnpm test:e2e` | API tests against MySQL / Playwright journeys (DOC-13 §2, §4) |
| `pnpm build` | Production build of everything |
| `docker compose up -d` | Local MySQL 8.4, MinIO, imgproxy, Mailpit (DOC-14 §3) |
| `pnpm --filter @noor/api db:generate -- --name <x>` / `db:migrate` / `db:seed` | Drizzle migrations and seed data (DOC-14 §5). Never `drizzle-kit push` |

Until the monorepo exists (task M0 in DOC-16), the current commands in the root `CLAUDE.md` apply.

## 5. Before writing code

Answer these in one or two lines each, in the conversation or the PR description. Skip only for a typo-level change.

1. **Which doc section and task id does this implement?** Task ids and their order are in DOC-16 §5. If none, ask.
2. **Does it already exist?** Search `packages/` and the feature folder first. Extend with a prop instead of writing a sibling.
3. **Does the platform, the standard library or an installed dependency already do it?** Native `<dialog>`/`<details>`/`Intl`/CSS before code; installed packages before new ones.
4. **What is the smallest change that satisfies the doc?** State what you are deliberately not building.
5. **Will two places use it?** Then it goes in `packages/` or `components/`, takes props, and has no hard-coded values.

A new dependency needs a line in the PR: name, size, why existing code or the platform is not enough. Without that line, do not add it.

## 6. Folder rules

| Rule | Detail |
|---|---|
| Features are independent | `features/a` never imports `features/b`; compose in a route (DOC-03 §5.3) |
| Shared code | Used by two features → `components/` or `lib/`. Used by two apps → a package |
| Contract first | Schema and route-table entry in `@noor/contract`, then the server handler, then the client call |
| UI primitives | Only from `@noor/ui`. Never import `@base-ui/react` or `@radix-ui/*` in an app |
| Data access | Admin: `features/*/api.ts`. Storefront: `*.server.ts` called from loaders/actions. Backend: only a module's `repository.ts` touches Drizzle (ADR-0016) |
| Backend modules | Import another module only through its `index.ts` |
| No barrels in apps | No `index.ts` re-export files inside `apps/*` |
| Docs | Live in `plan/`. A behaviour change updates the owning doc and its changelog in the same PR |

## 7. Do

- Parse every external input (network, URL, cookie, storage, env) with a Zod schema; derive types with `z.infer`.
- Keep money as integer paisa (`Money` / `*Minor`) and use the contract money helpers for all arithmetic and rounding.
- Let the server compute prices, discounts, shipping and totals; show pending states while waiting.
- Wrap every order/stock write in one DB transaction; lock variant rows in ascending id order (ADR-0020).
- Use semantic token utilities (`bg-surface`, `text-muted`) and logical direction utilities (`ms-`, `pe-`, `start-`).
- Give every list and async section loading, empty and error states.
- Give every interactive element a keyboard path, a visible focus state and an accessible name.
- Use message keys for user-visible strings in the storefront and `@noor/ui`.
- Return stable error `code`s from the API; map them to messages in the UI.
- Write the migration first, then the code; one schema change per migration file.
- Cite finding ids (`F-xx`, `K-x`) when fixing an audit item.
- Leave one small runnable test for any logic with a branch, a loop, or a money/stock/security path.

## 8. Do not

- Do not accept `total`, `discount`, `shippingFee` or any price from a client.
- Do not use floats for money, `decimal`/`float` columns for money, or `toFixed` for rounding.
- Do not derive an identifier from `max() + 1`; do not make the order number a secret (the tracking token is).
- Do not store domain data in `localStorage`; do not add a "mock mode" or `apiEnabled` branch.
- Do not put a secret, API key or admin credential in client code or in the repo. There is no `VITE_ADMIN_KEY`.
- Do not `fetch` in a component or in `useEffect`; do not copy server data into `useState`.
- Do not use `any`, `@ts-ignore`, non-null `!` (outside tests), `forwardRef`, or `asChild`.
- Do not write hex colours, arbitrary Tailwind values, `dark:` colour utilities or physical direction utilities (`ml-`, `pr-`, `left-`, `text-left`).
- Do not interpolate admin- or customer-supplied text into HTML, CSS or URLs without the validators named in DOC-04a §6 and DOC-04b (`LinkButton`).
- Do not log phone numbers, addresses or emails.
- Do not edit an applied migration, an Accepted ADR's meaning, or a stable error code / enum value / i18n key.
- Do not copy code from the old `admin-panel/`, `ecommerce-website/` or `mock-api/` without reading the audit finding that covers it (DOC-01 §7); several defects live inside working code.
- Do not build what the task did not ask for: no speculative options, abstractions or config.
- Do not push to `master`, skip hooks, or merge with a failing check.
- Do not read or commit the `*-codebase.zip` archives.

## 9. Definition of done

A task is done when **all** are true:

1. The behaviour matches the cited doc section, and that doc's acceptance checklist items touched by the change pass.
2. `pnpm check` passes; `pnpm build` passes.
3. New logic has a test that fails if the logic breaks; money, stock and auth paths always do.
4. UI changes: stories exist (including RTL), states for loading/empty/error exist, verified at 360 px (storefront) or 1280 px (admin), keyboard path checked.
5. API changes: route table, handler, OpenAPI snapshot and client updated together; errors use stable codes.
6. DB changes: migration committed separately, runs on an empty database and on the seeded one.
7. Docs: any behaviour that differs from a doc is reflected in that doc and its changelog; new terms are in the GLOSSARY.
8. The PR follows DOC-15 §5 and states what was verified and how. If something was not verified, the PR says so.

Report honestly: if a check fails or a step was skipped, say it with the output. Never describe unverified work as working.

## 10. When to stop and ask

- The doc for the area is "Not started", or two docs disagree.
- The task needs a decision an ADR has not made (a new dependency class, a new table, a new auth rule).
- The change would touch order totals, stock or payments in a way ADR-0020 or ADR-0017 does not describe.
- A required secret, credential or third-party account is missing.
- A destructive action is needed (dropping a table, rewriting history, deleting data).

## 11. Acceptance checklist

- [ ] The root `CLAUDE.md` links to this file and does not duplicate its rules.
- [ ] Every rule here names its owning doc or ADR, or is a repo-wide working rule.
- [ ] Commands in §4 exist in the root `package.json` once M0 is complete.

## 12. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-AG-1 | Backend, data, API, security, quality and roadmap rules | Added to this file as Phases 4–6 are written | Each phase |
| Q-AG-2 | `db:*` script names | As in §4 | DOC-08/DOC-14 choose different names |

## 13. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | First version (Phase 1) |
| 2026-10-02 | Phase 2: storefront specs exist (DOC-06.1 … 06.10) |
| 2026-10-02 | Phase 3: admin specs exist (DOC-07.1 … 07.15) |
| 2026-10-02 | Phase 4: backend, security and devops docs exist (DOC-08, DOC-11, DOC-14); commands updated |
| 2026-10-02 | Phase 5 part 1: data model exists (DOC-09.0 … 09.9) |
| 2026-10-02 | Phase 5 part 2: API docs exist (DOC-10.0 … 10.8) |
| 2026-10-02 | Phase 5 part 3: integrations doc exists (DOC-12) |
| 2026-10-02 | Phase 6: quality and roadmap docs exist (DOC-13, DOC-16); every doc in the set is now written |
| 2026-10-02 | Phase 7 consistency review: test commands added; all route keys, enum values and table names in the set now agree with DOC-09 and DOC-10 |

# 15 — Conventions

| Field | Value |
|---|---|
| ID | DOC-15 |
| Title | Naming, git and branching, commits, pull requests, code review |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-03 |
| Decisions used | ADR-0002, ADR-0003, ADR-0006, ADR-0013, ADR-0018 |

## 1. Purpose and scope

**Governs:** how things are named, how changes move from a branch to `master`, and what a reviewer checks.
**Does not govern:** architecture (DOC-03, DOC-08), CI job definitions (DOC-13, DOC-14), database naming details beyond the summary in §2.4 (DOC-09).

## 2. Naming

### 2.1 Files and folders

| Thing | Convention | Example |
|---|---|---|
| React component file | `PascalCase.tsx`, one exported component | `ProductTable.tsx` |
| `@noor/ui` component file | `kebab-case.tsx` (matches the export path) | `quantity-stepper.tsx` |
| Hook | `useCamelCase.ts` | `useCartUi.ts` |
| Other JavaScript | `kebab-case.js` | `query-client.ts`, `theme.server.ts` |
| Storefront route module | lower-case, as listed in `routes.ts` | `routes/product.tsx` |
| Server-only file (storefront) | `.server.ts` suffix | `catalog.server.ts` |
| Test | next to the file, `.test.ts(x)` | `money.test.ts` |
| Story | next to the component, `.stories.tsx` | `button.stories.tsx` |
| Folder | `kebab-case`, feature folders are plural nouns | `features/products` |
| Doc | `NN-kebab-case.md` | `15-conventions.md` |

### 2.2 Code

| Thing | Convention | Example |
|---|---|---|
| Variable, function | `camelCase` | `formatMoney` |
| Component, type, Zod schema | `PascalCase`; a schema and its inferred type share one name | `export const Product = z.object(…)` / `export type Product = z.infer<typeof Product>` |
| Constant | `UPPER_SNAKE_CASE` only for true constants at module scope | `MAX_CART_LINES` |
| Boolean | `is`/`has`/`can`/`should` prefix | `isSoldOut` |
| Event prop / handler | `onX` prop, `handleX` function | `onValueChange`, `handleSubmit` |
| Money value | suffix `Minor` for a bare integer of paisa; a `Money` object has no suffix | `totalMinor: number`, `total: Money` |
| Id | `id`, `<entity>Id`; never `ID` or `_id` | `variantId` |
| Date/time field | ISO-8601 string, suffix `At` | `createdAt`, `dispatchedAt` |
| Enum values (contract, DB) | `snake_case` strings | `'pending_confirmation'` |
| Route table key | `<module>.<verbNoun>`; admin keys start with `admin.` | `catalog.listProducts`, `admin.orders.transition` |
| Query key root | plural feature name | `['products']` |
| i18n key | `<area>.<element>[.<state>]`, lower camel inside segments | `cart.empty.title` |
| Error code | `snake_case`, stable, never reworded | `insufficient_stock` |
| CSS class | Tailwind utilities only; no custom class names in apps | — |
| Environment variable | `UPPER_SNAKE_CASE`; browser-visible ones start with `VITE_` (admin) or `PUBLIC_` (storefront) | `API_INTERNAL_URL` |

Domain words come from the GLOSSARY and are used exactly: `colorway` (not "colour variant"), `variant`, `component` (a garment piece, only inside the catalog domain), `reservation`, `handle`.

### 2.3 API (summary; DOC-10 conventions owns the detail)

| Thing | Convention |
|---|---|
| Path | `/api/v1/<plural-kebab>`; admin under `/api/v1/admin/…` |
| JSON fields | `camelCase` |
| Query params | `camelCase`; filters on attributes use `attr.<code>` |

### 2.4 Database (summary; DOC-09 owns the detail)

| Thing | Convention |
|---|---|
| Table | plural `snake_case` (`order_lines`) |
| Column | `snake_case`; money `*_minor`; timestamps `*_at`; FK `<entity>_id` |
| Index / constraint | `<table>_<columns>_idx`, `<table>_<columns>_uq`, `<table>_<rule>_chk`, `<table>_<column>_fk` |
| Migration file | generated number + `snake_case` description |

## 3. Branching

Trunk-based with short-lived branches.

| Rule | Value |
|---|---|
| Default branch | `master` (the current repo default); always deployable to staging |
| Branch name | `<type>/<task-id>-<kebab-summary>`, e.g. `feat/M1-014-cart-drawer`, `fix/F-07-tracking-phone-format`, `docs/doc-09-orders` |
| Lifetime | Merged or closed within 3 working days; larger work is split or sits behind a feature flag |
| Update from `master` | Rebase before review; after review starts, merge `master` in (no force-push over reviewed commits) |
| Merge method | Squash merge; the PR title becomes the commit subject |
| Direct pushes to `master` | Not allowed (branch protection), including for the tech lead and for AI agents |
| Release | A tag `v<yyyy>.<mm>.<dd>.<n>` on `master` triggers a production deploy (DOC-14) |

## 4. Commits

Conventional Commits. The squash commit (= PR title) must follow it; commits inside a branch should.

```
<type>(<scope>): <imperative summary, lower case, no full stop, max 72 chars>

<body: why, not what; wrap at 100>

Refs: M1-014, F-07, ADR-0020
```

| Type | Use |
|---|---|
| `feat` | User-visible behaviour |
| `fix` | Bug fix (cite the audit finding if one applies) |
| `refactor` | No behaviour change |
| `perf` | Measured performance change |
| `test` | Tests only |
| `docs` | `plan/` or README changes |
| `chore` | Tooling, deps, config |
| `db` | A migration (always its own commit and named in the PR) |

Scopes: `api`, `admin`, `storefront`, `contract`, `ui`, `i18n`, `config`, `plan`, `repo`.

Examples: `feat(storefront): add cart drawer with server totals`, `fix(api): aggregate stock per variant across order lines`, `db(api): add inventory_levels`.

## 5. Pull requests

Size: aim for under 400 changed lines excluding lockfiles, generated files and snapshots. A larger PR needs a sentence in the description saying why it could not be split.

`.github/pull_request_template.md`:
```markdown
## What and why
<!-- 2–4 sentences. Link the task: M1-014. -->

## Docs
- Implements: DOC-__ §__  (and ADR-____)
- Fixes findings: F-__ / K__   <!-- or "none" -->
- [ ] I updated the doc and its changelog if behaviour differs from it

## How to verify
<!-- Commands and clicks a reviewer can follow. -->

## Checklist
- [ ] `pnpm check` passes locally
- [ ] Contract changed first (route table / schema), then server, then client
- [ ] New UI has loading, empty and error states (DOC-04c §6)
- [ ] New or changed component has stories incl. RTL (DOC-04b §2)
- [ ] No money maths outside `@noor/contract` money helpers; no float rupees
- [ ] No new dependency, or it is justified below
- [ ] Migration is its own commit and is safe to re-run after a partial failure (ADR-0008)
- [ ] Screenshots at 360 px (storefront) / 1280 px (admin) for UI changes

## New dependencies
<!-- name, size, why not existing code or the platform -->
```

Rules: at least one approving review from a human; the author merges; a PR that changes `plan/02-decisions/` needs the tech lead's approval; an AI agent's PR is reviewed like any other and names the agent in the description.

## 6. Required checks before merge

| Check | Command | Owner doc |
|---|---|---|
| Types | `pnpm typecheck` | ADR-0002 |
| Lint (incl. import boundaries, no JSX literals in storefront/ui) | `pnpm lint` | DOC-03 §5.3 |
| Unit and component tests | `pnpm test` | DOC-13 |
| Logical-properties scan | `node scripts/check-logical.mjs` | DOC-04a §10 |
| Contrast gate | `node packages/ui/scripts/check-contrast.mjs` | DOC-04a §9 |
| OpenAPI snapshot unchanged or updated | part of `pnpm test` in `@noor/contract` | ADR-0005 |
| Build | `pnpm build` | — |

`pnpm check` runs the first six locally. CI runs all eight (DOC-13 defines the pipeline).

## 7. Code review checklist

**Correctness and scope**
- [ ] Does what the linked task and doc section say; nothing extra.
- [ ] Acceptance checklist of each cited doc still holds.
- [ ] Edge cases: empty list, one item, maximum, sold out, made-to-order, RTL, slow network.

**Boundaries**
- [ ] No cross-feature import; nothing in an app that belongs in a package (used by two apps).
- [ ] Types and schemas come from `@noor/contract`; every external input is parsed.
- [ ] No `fetch` outside the API client; no `localStorage` outside the allowed file.
- [ ] No barrel `index.ts` added inside an app.

**Money, stock, orders** (highest risk, DOC-01 §4.1)
- [ ] The client sends no price, discount, shipping fee or total.
- [ ] Integer paisa end to end; rounding only through the contract helper.
- [ ] Stock and order status change only inside the server functions that own them.

**UI**
- [ ] Only `@noor/ui` components and semantic tokens; no hex, no arbitrary values, no physical direction utilities.
- [ ] Keyboard path works; focus is visible; labels and `alt` present.
- [ ] Loading, empty and error states exist.
- [ ] Strings are message keys (storefront, ui).

**Security and privacy**
- [ ] No secret, key or token in client code, logs or the repo.
- [ ] Customer data printed into HTML is escaped; no `dangerouslySetInnerHTML` without a sanitiser named in the PR.
- [ ] Admin-supplied values that reach CSS or URLs are validated (DOC-04a §6, `LinkButton`).
- [ ] Phone, address and email are not logged.

**Simplicity**
- [ ] No abstraction with a single use; no option nobody asked for; no dependency a few lines would replace.
- [ ] Deleted code is deleted, not commented out.

**Tests and docs**
- [ ] Logic with a branch or a money/stock path has a test that would fail if it broke.
- [ ] Docs and changelogs updated where behaviour changed.

## 8. Comments and documentation in code

- Comment **why**, constraints and non-obvious consequences; never restate the code.
- A deliberate shortcut with a known ceiling is marked `// ponytail: <ceiling>, <upgrade path>` so `grep -rn "ponytail:"` lists the debt.
- `TODO` must carry a task id: `// TODO(M2-031): …`. A bare `TODO` fails lint.
- Exported functions in `@noor/contract` and `@noor/i18n` have a one-line TSDoc summary.

## 9. Rules

**Always:** cite the doc section and task id in the PR; put the contract change first; keep a migration in its own commit.
**Never:** push to `master`; merge with a failing check; mix a refactor with a behaviour change in one PR; rename a stable error code, enum value or i18n key without a migration note.
**Common mistakes:** a PR titled "updates"; fixing an audit finding without citing its id (it then stays open in DOC-16); squashing a migration into a feature commit.

## 10. Acceptance checklist

- [ ] Branch protection on `master`: PR required, 1 approval, all §6 checks required.
- [ ] `.github/pull_request_template.md` exists with the §5 content.
- [ ] A commit-message lint (commitlint with the config-conventional preset, run on the PR title in CI) rejects a non-conforming title.
- [ ] `grep -rnE "TODO(?!\()" apps packages` (run with `grep -P`) returns nothing.

## 11. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-15-1 | Git host | GitHub (the Render blueprint and README assume it) | Different host → adapt the template path and protection settings |
| Q-15-2 | Default branch name | Stays `master` | Owner renames it |
| Q-15-3 | One human reviewer is enough | Team of 2–3 (A-01) | Team grows past 4 → two reviewers for `api` money/stock paths |

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 1) |
| 2026-10-02 | Phase 7 consistency review: example route key exists in DOC-10 |
| 2026-10-04 | ADR-0021: JavaScript with JSDoc; `.ts`/`.tsx` names in this document mean `.js`/`.jsx`; the TS-ratio gate is removed |

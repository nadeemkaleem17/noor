# noor

Online fashion store for Pakistan (PKR). Customers see the name **Rubaya** (domain `rubaya.pk`);
"noor" is only the internal project, repo and package name (`@noor/*`).

Everything is built and run **locally** first. Production is a separate, later phase.

## How to work here

1. **Read [plan/AGENTS.md](plan/AGENTS.md) first**, then only the doc your task cites. The plan in `plan/` is the
   source of truth (81 files; do not read it whole). [plan/README.md](plan/README.md) is the index.
2. **Take the next task from [plan/16-roadmap.md](plan/16-roadmap.md) §5**, in order. Each task names the doc
   sections that specify it and what "done" means. Tick it in §8 when finished.
3. **Before writing code, answer in one or two lines each** (skip only for typo-level edits):
   - Which task id and doc section is this?
   - Does it already exist here? Extend it with a prop instead of writing a sibling.
   - Does the platform, the standard library or an installed dependency already do it?
   - What is the smallest change that satisfies the doc, and what am I deliberately not building?
   - Will two places use it? Then it goes in `packages/` or a shared folder and takes props.
4. **Ponytail mode is on**: simplest solution that works, no speculative abstractions, no new dependency
   without a stated reason. Never simplify away validation, error handling, security or accessibility.
5. If the plan is wrong or silent, fix the doc in the same change. If code and plan disagree, the plan wins.
6. Report honestly: what was verified, what was not, and any failing check with its output.

## Current state (update when it changes)

| | |
|---|---|
| Roadmap position | Milestone **M0 Foundation**: M0-01, 02, 04, 05, 09, 13 done (CI never run: needs a GitHub push). M0-03, M0-06, M0-07 need native MySQL 8.4 (no Docker). Next: **M0-06** (Drizzle on MySQL spike) once MySQL is installed; otherwise **M0-10** (UI tokens/Storybook) |
| Branch | `chore/M0-01-workspace` (nothing committed yet; `master` is the default branch) |
| New code | `packages/config`, `packages/contract`, `apps/api` (Fastify skeleton: config, errors, route registrar, OpenAPI snapshot; 2 placeholder handlers) |
| Running today | The old admin against the old mock API |

Open items on this machine:
- **No Docker, by decision.** Local MySQL 8.4 is installed natively (plan/14-devops.md §3.4; XAMPP's MariaDB does not work). Use `STORAGE_DRIVER=local`, `IMAGE_TRANSFORM=none`; spike M0-08 (MinIO/imgproxy) is skipped.
- `typescript` is pinned `~6.0.3` and `typescript-eslint` `~8.70.1`: pnpm's 7-day release-age gate refuses newer ones. Do not disable the gate; pin an older release.
- **Node 24.14** is installed (the plan pinned 22.22; `engines` is `>=22.22`, `.nvmrc` says 24).
- `pnpm` was installed with `npm i -g pnpm@11.28.3` (`corepack enable` needs administrator rights here).
- Three empty folders `admin-panel/`, `ecommerce-website/`, `mock-api/` may remain at the root: they are locked by
  old dev servers still running. Stop those terminals, then delete the three folders.

## Layout

```
apps/admin/          old admin dashboard, moved from admin-panel/ (React 19, Vite 8, JSX, Radix, zod 3).
                     Rebuilt screen by screen from milestone M3; do not add features to the old code.
legacy/mock-api/     old in-memory Express API. Only here so the old admin runs. Deleted at M7.
legacy/storefront/   old customer site. Reference only; no lint script (old lint errors, frozen); it is rewritten as apps/storefront (M5). Deleted at M7.
plan/                the documentation set
package.json  pnpm-workspace.yaml  turbo.json
```

Target layout (plan/03-frontend-architecture.md §3): `apps/{api,admin,storefront}`, `packages/{contract,ui,i18n,config}`.

## Commands (repo root)

```
pnpm install
pnpm dev          # old admin (:5173) + legacy mock API (:3000)
pnpm test         # vitest: apps/admin, apps/api, packages/config, packages/contract
pnpm --filter @noor/api start   # API on 127.0.0.1:3000 (needs NODE_ENV, APP_ENV, ADMIN_ORIGIN; see apps/api/.env.example)
pnpm lint
pnpm build
pnpm check        # typecheck + lint + test + TypeScript-share check
pnpm route-keys   # write plan/10-api/route-keys.txt; --check: contract routes must be documented
pnpm --filter @noor/admin <script>
```

Env files (gitignored, already present): `legacy/mock-api/.env` (`ADMIN_KEY=dev-key`),
`apps/admin/.env.local` (`VITE_API_URL=http://localhost:3000`, `VITE_ADMIN_KEY=dev-key`).

## Target stack (decisions in plan/02-decisions/)

| Area | Decision |
|---|---|
| Backend | Node.js, Fastify 5 modular monolith, TypeScript |
| Database | MySQL 8.4 + Drizzle ORM (`mysql2`). Order and invoice numbers from a `counters` table |
| Jobs / search | Own `jobs` table + outbox in MySQL; InnoDB `FULLTEXT` + synonyms |
| Contract | One Zod 4 package shared by all apps; REST under `/api/v1`; OpenAPI generated |
| Storefront | React Router 8 framework mode, server-rendered |
| Admin | React SPA; TanStack Query; no localStorage domain data, no mock mode |
| UI | `@noor/ui`: owned components on Base UI, Tailwind v4, semantic tokens, logical (RTL-safe) properties |
| Auth | Server sessions, Argon2id, TOTP, role permissions. No shared admin key |
| Money / orders | Integer paisa only; server computes every price; idempotent order creation; stock reserved then committed |
| Launch scope | Cash on delivery only; Pakistan only; no external service needed to run locally |

## Rules that are easy to break

- Money is `{ amount, currency: 'PKR' }` in integer paisa (`699000` = Rs. 6,990). No floats, ever.
- The client never sends a price, discount, fee or total.
- Order status, stock and payment status change only through the functions named in plan/09-data-model/07 and 04.
- Do not copy code from `legacy/` or the old `apps/admin` without reading the audit finding that covers it
  (plan/01-audit.md): several defects live inside working code.
- Cite the finding id (`F-xx`, `K-x`) in any change that fixes an audit item.
- Do not commit or push unless asked. Never push to `master` directly.

## The old admin (`apps/admin/src`), until it is replaced

- `lib/db.js` is its only data layer (localStorage, or the mock API when `VITE_API_URL` is set); pages use
  `hooks/useCollection.js` (`useCollection(name)`, `useSingleton(name)`).
- `contract/schemas.js` (zod 3) + `fixtures.js` become `packages/contract` and the seed data (tasks M0-04, M1-13).
- Shared pieces: `components/Field.jsx`, `components/ui.jsx`, `components/ImageUpload.jsx`, `lib/format.js`,
  `lib/variants.js`, `lib/images.js`, `lib/orders.js`, `lib/invoice.js`.
- Tests: `src/lib/__tests__` (vitest). They force local mode.

## Known gotchas

- The mock API loses all data on restart.
- `apps/admin/README.md` and `legacy/storefront/README.md` are the untouched Vite template.
- `legacy/storefront/CHANGELOG_THIS_PASS.md` describes seller features that do not exist.
- `*.zip` archives in the old project folders are ignored by git; do not read or commit them.
- `plan/NOOR_DOCS.md` is a stale single-file snapshot of Phase 0; the split files govern.

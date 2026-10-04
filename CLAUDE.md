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
| Roadmap position | Milestone **M0 Foundation**: all of M0 done (M0-08 skipped) (CI never run: needs a GitHub push). M0-03, M0-06, M0-07 need native MySQL 8.4 (no Docker). M1-01 (platform), M1-02 (auth) and M1-03 (audit), M1-04 (security plumbing) and M1-05 (media, local storage) and M1-06 (settings, pages, menus) and M1-07 (shipping) done. Next: **M1-08** (catalog taxonomy) |
| Branch | `chore/M0-01-workspace`, one commit per M0 task, not pushed (`master` is the default branch) |
| New code | `packages/config`, `packages/contract`, `apps/api` (Fastify skeleton), `packages/ui` (tokens.css, `cn`, contrast gate, `themeCss`, `DirectionProvider`, `safeHref`, Storybook; components in `src/components/`, one file per family, imported as `@noor/ui/<name>`: Button, Field, Input, Textarea, NativeSelect, Checkbox, RadioGroup, Switch, NumberInput, MoneyInput, PhoneInput, QuantityStepper, OptionChips, Spinner, Dialog, Drawer, ConfirmDialog, Popover, Menu, Tooltip, Toast, Select, Combobox, Tabs, Accordion, Breadcrumb, Pagination, LoadMore, Badge/StatusBadge, Card, Skeleton, EmptyState, ErrorState, Table, Carousel, Link, Ltr, VisuallyHidden, Image, Price, Markdown, RHFField (in field.jsx), ImageUpload). Every story is axe-checked by `test/stories.a11y.test.jsx` (add a story file and it is covered). Component tests: `packages/ui/test/*.test.jsx` use jsdom + Testing Library via `test/dom.tsx` (`renderUi`); put `// @vitest-environment jsdom` at the top of such a file, `packages/i18n` (en/ur catalogs, `createI18n`, `formatMoney/Date/Number`), `apps/storefront` (React Router 8 skeleton: one page, en + `/ur`) |
| Backend platform | `apps/api/src/platform/`: `db.js` (pool, `transaction()` retries deadlocks, `Executor` type for pool-or-tx), `clock.js` (`now()`, freeze in tests), `jobs.js` + `worker.js` (queue), `outbox.js` (`emit(tx, ..)`, relay), `scheduler.js`, `idempotency.js`, `rate-limit.js`, `counters.js`, `cache.js`, `ids.js` (UUIDv7), `runtime.js` (starts relay + scheduler + worker). Schema in `src/db/schema/platform.js`; migrations in `apps/api/drizzle` (`pnpm --filter @noor/api db:generate` then `db:migrate`). Integration tests are `*.int.test.js` and use a scratch database per file; they skip with a warning if MySQL is not running |
| Auth | `apps/api/src/modules/auth/` (service, repository, sessions, http, routes, roles matrix, password, secrets, totp, recovery) and `modules/audit` (`record(tx, ...)`). Staff routes use `auth: 'staff'` + a permission, `'staff-any'` for self-service, `stepUp: true` for password re-check. Create the first owner: `pnpm --filter @noor/api cli owner:create --email .. --name ..` (hidden password prompt). Dev cookie name is `rb_admin_dev` (set in `.env`) |
| Media | `apps/api/src/modules/media/` (upload slot -> signed PUT -> confirm -> job `media.process`). Files live in `apps/api/.data/storage` (`STORAGE_DRIVER=local`); the API serves generated sizes at `/img/...`. Images only; SVG and video are not accepted yet. `src/modules/index.js` `backgroundOf()` lists the job handlers and schedules of all modules |
| Settings and content | `apps/api/src/modules/settings/`: five JSON documents (`store`, `theme`, `checkout`, `payments`, `home`) with versions, pages, menus, public `store.getConfig` and `content.*`. A document never saved reads as its default, version 0. The contrast gate and the link rule live in `@noor/contract` (`contrastFailures`, `isValidLink`); `@noor/ui/contrast` and `@noor/ui/safe-href` re-export them |
| Shipping | `apps/api/src/modules/shipping/`: cities, zones with methods, couriers, `quote(db, { cityId, methodId?, amountAfterDiscount })`. `seedShipping(db)` (242 cities, 6 couriers) is idempotent and is part of the base seed (M1-13). `shipping.facts()` feeds the store configuration |
| Running today | The old admin against the old mock API |

Open items on this machine:
- **Database:** MySQL **8.4.11** runs on **127.0.0.1:3307** as a plain process (not yet a Windows service; start/install command in plan/14-devops.md section 3.4). Root password: `.data/mysql-root.txt` (gitignored). Databases `rubaya`, `rubaya_test`; users `rubaya_app` and `rubaya_migrate` (passwords in `apps/api/.env`). If the process is not running, start it first, then `pnpm --filter @noor/api db:migrate`. Spikes: `spike:drizzle`, `spike:jobs`.
- **No Docker, by decision.** Local MySQL 8.4 is to be installed natively (plan/14-devops.md §3.4; XAMPP's MariaDB does not work). Use `STORAGE_DRIVER=local`, `IMAGE_TRANSFORM=none`; spike M0-08 (MinIO/imgproxy) is skipped.
- **Writing JavaScript here:** types are JSDoc (`@param`, `@returns`, `@type`, `@template`, `@typedef`; Zod shapes via `z.infer`). Relative imports in Node-run code (`packages/contract`, `packages/i18n`, `apps/api`, `scripts`) need the `.js` extension; Vite code does not. A multi-line JSDoc right after `return` breaks the return (wrap in parentheses). Tuple rest params: `@param {Args<..>} args` without `...`. A converter that did the TS to JS change is not kept; the details are in ADR-0021.
- On Windows pnpm can leave a broken `jsdom` link inside a `vitest` folder in `node_modules/.pnpm` (jsdom tests then fail with "Cannot find package"). `scripts/fix-pnpm-links.mjs` repairs it and runs as `postinstall`; run it by hand if a jsdom test run breaks after `pnpm add`.
- `typescript` (dev tool only) is pinned `~6.0.3` and `typescript-eslint` `~8.70.1`: pnpm's 7-day release-age gate refuses newer ones. Do not disable the gate; pin an older release.
- **Node 24.14** is installed (the plan pinned 22.22; `engines` is `>=22.22`, `.nvmrc` says 24).
- `pnpm` was installed with `npm i -g pnpm@11.28.3` (`corepack enable` needs administrator rights here).

## Layout

```
apps/admin/          old admin dashboard, moved from admin-panel/ (React 19, Vite 8, JSX, Radix, zod 3).
                     Rebuilt screen by screen from milestone M3; do not add features to the old code.
legacy/mock-api/     old in-memory Express API. Only here so the old admin runs. Deleted at M7.
apps/storefront/     new customer site (React Router 8, SSR; routes in app/routes.js; `~/` = app/; env in .env, see .env.example).
legacy/storefront/   old customer site. Reference only; no lint script (old lint errors, frozen); it is rewritten as apps/storefront (M5). Deleted at M7.
plan/                the documentation set
package.json  pnpm-workspace.yaml  turbo.json
```

Target layout (plan/03-frontend-architecture.md §3): `apps/{api,admin,storefront}`, `packages/{contract,ui,i18n,config}`; all exist now (admin is still the old code).

## Commands (repo root)

```
pnpm install
pnpm dev          # old admin (:5173) + legacy mock API (:3000)
pnpm test         # vitest: apps/admin, apps/api, packages/config, packages/contract
pnpm --filter @noor/api start   # API on 127.0.0.1:3000 (needs NODE_ENV, APP_ENV, ADMIN_ORIGIN; see apps/api/.env.example)
pnpm lint
pnpm build
pnpm check        # typecheck (tsc --checkJs) + lint + test + physical-direction (RTL) check
pnpm --filter @noor/storefront dev     # new storefront on :5174 (the old legacy/storefront also uses 5174: run one)
pnpm --filter @noor/storefront build && pnpm --filter @noor/storefront start   # production server: CSP header is sent only here
pnpm --filter @noor/ui storybook   # component workshop on :6006 (toolbars: brand, scheme, direction)
pnpm route-keys   # write plan/10-api/route-keys.txt; --check: contract routes must be documented
pnpm --filter @noor/admin <script>
```

Env files (gitignored, already present): `legacy/mock-api/.env` (`ADMIN_KEY=dev-key`),
`apps/admin/.env.local` (`VITE_API_URL=http://localhost:3000`, `VITE_ADMIN_KEY=dev-key`).

## Target stack (decisions in plan/02-decisions/)

| Area | Decision |
|---|---|
| Language | **JavaScript with JSDoc types** (ADR-0021). No `.ts`/`.tsx`, no TypeScript syntax. `tsc --checkJs` is the typecheck (`pnpm typecheck`) |
| Backend | Node.js, Fastify 5 modular monolith, plain JavaScript run by Node (no build, no tsx) |
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

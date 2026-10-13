# apps/api: the backend (read this instead of scanning `src/`)

Node 24, plain JavaScript + JSDoc (no build, no tsx), Fastify 5, Drizzle ORM on MySQL 8.4, one Zod contract shared with both frontends. A **modular monolith**: one process serves the
storefront's public API and the admin's staff API; a background process (or the same one with `DEV_INLINE_WORKER=1`) runs jobs. Port 3000. Plan: `plan/08-backend-architecture.md`,
`plan/09-data-model/`, `plan/10-api/`, `plan/11-security-auth.md`.

## How a request goes

`packages/contract/src/*.js` is the **only list of endpoints** (`defineRoutes({...})`, key `'orders.create'`, fields `method path auth permission params query body response status
rateLimit idempotent stepUp cache`). `src/app.js` `buildApp({config, db, storage, ...})` registers a handler for every key through `platform/http/route-registrar.js`, which validates
params/query/body with the Zod schemas, applies `auth` (`public | cart | order-token | staff | staff-any | staff-pending | webhook`), the permission, rate limit bucket, idempotency key
and `Cache-Control` (`cache: 'shared'` = `public, s-maxage=60, swr=600`), and parses the response (a response that does not match its schema is a bug, not an answer).
Adding an endpoint = contract entry first, then handler in the module, then a call from the client, then `pnpm route-keys` (+ `plan/10-api/*` doc row; `apps/api/test/openapi.snapshot.json`
is a snapshot: `vitest run test/app.test.js -u` after a contract change).

Errors are `DomainError(code, details)` (`platform/errors.js`) -> problem+json `{type,title,status,code,detail?,issues?,requestId, ...details}`. Codes and their HTTP status live in
`packages/contract/src/errors.js` (`errorStatus`); clients branch on `code` only. `ApiError.details` carries the extra keys (e.g. `available`, `cart`, `minSpend`).

## Where things are

```
src/main.js            boots: config -> db -> buildApp -> listen (+ inline worker when DEV_INLINE_WORKER=1)
src/worker.js          the background process: outbox relay + scheduler + job worker (platform/runtime.js)
src/cli.js             `pnpm --filter @noor/api cli owner:create --email .. --name ..`
src/app.js             Fastify assembly (plugins, security hooks, swagger, route registration, per-request log line)
src/platform/          config.js (the ONLY reader of process.env; Zod; a bad value stops boot), db.js (pool, transaction() with deadlock retry, Executor type),
                       errors.js, logger.js, ids.js (UUIDv7), clock.js (now(), freezable in tests), jobs.js + worker.js, outbox.js (emit(tx,..)), scheduler.js,
                       idempotency.js, rate-limit.js, counters.js (order numbers), cache.js, storage.js (local driver; signed PUT), csv.js, search-text.js (prefix-LIKE helpers),
                       http/ (route-registrar, security hooks: CSRF origin check for /admin + dev upload, rate-limit, storage-routes = dev upload PUT + /img)
src/db/schema/*.js     Drizzle tables, one file per area (platform, auth, audit, media, settings->content, taxonomy, products, inventory, search, shipping, customers,
                       promotions, cart, orders, payments, reviews, notifications, reporting). Migrations: apps/api/drizzle (`db:generate` then `db:migrate`)
src/modules/<area>/    the business code; every module = service.js (rules) + repository.js (queries) + routes.js or index.js (handlers) [+ jobs/events]
src/modules/index.js   the one place that lists modules: appHandlers (route handlers), eventHandlers (outbox event -> job), backgroundOf() (job handlers + schedules)
src/modules/services.js createServices({db, config, storage, ...}) wires every service once (used by app, worker and seed)
src/seed/              base (settings, pages, menus, shipping, size systems, synonyms, counters), owner, demo (24 products via the real services), perf (3,000 products)
perf/                  `pnpm test:perf` (~2 min): query plans + latency budgets on a shop at planned size (not part of `pnpm test`)
test/                  *.test.js (pure) and *.int.test.js (a scratch MySQL database per file; skip with a warning when MySQL is down), test/support/ harness
```

## Modules (what each owns)

| Module | Owns |
|---|---|
| `auth` | staff, roles matrix (`roles.js`), Argon2id passwords, sessions + CSRF token, TOTP (AES-GCM secrets), recovery codes, invites, `stepUp` password re-check. `createAuthorize()` is the `authorize` hook |
| `audit` | `record(tx, {...})`: every staff change writes an audit row inside its transaction; history panels read it |
| `settings` | five JSON documents (`store`, `theme`, `checkout`, `payments`, `home`) each with a `version` (stale write = 409 `stale_write`), CMS pages, menus, public `store.getConfig` and `content.*`; `tokens.js` `resolveTokens` puts `{{store.phone}}`, `{{shipping.fee}}`... into page text on the way out |
| `shipping` | cities (242), zones, methods, couriers; `quote()`; `facts()` feeds config; `publicCities()` |
| `catalog` | categories, attributes, sizes + charts, form schemas (custom size), products (one JSON document saved whole with `version`; `recomputeProductCache` is the only writer of derived price/stock/size columns), collections, `public*.js` (the one listing query builder: items + total + facets + price presets in one call; `ids` lookup, cursor paging) |
| `inventory` | on-hand/reserved change ONLY here (`reserve release commit restock editReserved adjust`), in the caller's transaction, variants locked in ascending id order, ledger row per change |
| `search` | FULLTEXT index + synonyms, `run({q, where})` is the one text query; reindex jobs start from outbox events |
| `media` | upload slot -> signed PUT -> confirm -> job `media.process` (sizes); `imagesFor(ids)` gives `Image` objects |
| `customers` | one row per phone; `upsertByPhone`, `applyOrderChange` are for the order transaction |
| `promotions` | `evaluatePromo` is the ONLY place a discount is computed; `redeem/reverse` in the order transaction |
| `cart` | server cart (token hash, lines identified by variant+customization hash); `priceCart` in `pricing.js` is the one pricing function; `cart.price(x, row, {cityId, methodId, phone})` is what orders call |
| `orders` | create (idempotent), `changes.js` is the ONLY writer of `orders.status`, edit, rules, holds, public (token views, cancel, switch to COD, track), admin (list/search/masking/bulk/CSV export), notes |
| `payments` | `status.js` the one `payment_status` formula, `recompute` the only writer of paid/refunded; providers `cod manual bank_transfer` (+test `fake`); webhook route outside the contract table; job `orders.expire_unpaid` |
| `notifications` | job `notify.order` writes `notification_log` once per message (`skipped` while no provider; email via `MAIL_URL`) |
| `reviews` | per order line, `pending` until moderated; `catalog/products.js recomputeRating` writes rating columns |
| `reporting` | dashboard/summary figures in SQL over Pakistan days, zero-result searches, admin search, system info, web vitals + client errors intake |

## Rules that bite (learned the hard way)

- **Never use the shared pool inside a transaction**: read through `tx` (`settings.value(key, tx)`); a second connection deadlocks the first.
- MySQL runs `ONLY_FULL_GROUP_BY`: `GROUP BY` must repeat the exact selected expression.
- Search is by prefix (`LIKE 'x%'`), never `'%x%'` (no index): use `platform/search-text.js`.
- Money is integer paisa everywhere; JSON-LD/decimal strings come from `moneyToDecimalString`. The client never sends a price/discount/fee/total (`expectedTotal` is only a guard).
- The API runs on **plain Node**, not Vite: JSON imports need `with { type: 'json' }`, relative imports need `.js`; tests run under Vite and hide this, `test/node-esm.test.js` guards it.
- Status, stock and payment status change only through the single functions named above. Adding a status writer elsewhere breaks invariants.
- `X-Internal-Key` (config `INTERNAL_KEY`) is how the storefront server proves itself so its forwarded client IP is believed; the storefront sends it since M7-01 (set `TRUSTED_PROXY_HOPS` there for the address to be passed).
- `RELAXED_PASSWORDS=1` (only with `APP_ENV=local`) turns the password rule into 5 to 128 characters; the API refuses to start with it anywhere else.
- Unsafe methods under `/api/v1/admin` and the dev upload link require `Origin === ADMIN_ORIGIN`, except a signed upload PUT with **no** Origin (the storefront server's review photo): the signature is the credential.
- Local sign-in: `TWO_FACTOR_REQUIRED=0` in `.env` (allowed only in local/CI). Cookie `rb_admin_dev`. First owner: seed prints `owner@rubaya.test` + random password once.
- `node --env-file-if-exists=.env src/main.js` has NO watch: restart the API after changing backend code (`preview_start` name `api`, or `pnpm --filter @noor/api start`).

## Commands

```
pnpm --filter @noor/api start | db:migrate | db:generate | db:seed [--base-only|--no-demo|--perf] | cli owner:create ... | cli launch:check (what stands between this shop and opening)
pnpm --filter @noor/api test            # needs MySQL on :3307 for *.int.test.js (they skip with a warning otherwise: check MySQL is up when tests look "skipped")
pnpm --filter @noor/api test:perf | test:coverage
```

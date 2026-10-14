# apps/e2e: the end-to-end journeys (read this before touching a journey)

Playwright against the **built** storefront and admin, a **real API** and a **scratch MySQL database**. The 17 journeys of `plan/13-quality.md` §4 are `tests/NN-*.spec.js`;
accessibility (axe, WCAG 2.2 AA) runs on the pages E2E-01, 08, 09 and others visit (`support/axe.js`); `tests/18-accessibility-sweep.spec.js` (not a journey) scans every storefront and admin screen and the storefront at 320 px. Plan: `plan/13-quality.md` §4, §7, §11.

```
pnpm test:e2e                    # from the repo root: prepare (database + builds), start the three servers, run every journey (~8 min)
E2E_SKIP_BUILD=1 pnpm test:e2e   # the same, keeping the last builds of the storefront and the admin (rebuild after a source change!)
pnpm --filter @noor/e2e test:only -- tests/06-track.spec.js    # one file, on the database already prepared (see "state" below)
pnpm --filter @noor/e2e serve    # the three servers by hand (API 3100, storefront 4174, admin 4173) to look at the prepared shop
```

## How it runs

- `env.mjs` is the one place for ports, addresses, the scratch database (`rubaya_test_e2e`, made by the migration user from `apps/api/.env` or from `DATABASE_*` in the environment), the staff accounts and their password.
- `scripts/prepare.mjs` drops and makes the database, migrates, seeds (base + demo shop), creates the staff (`e2e-owner`, `e2e-fresh`, `e2e-viewer`), then builds the storefront and the admin with the scratch API address baked in. It also clears `.data/e2e`.
- `playwright.config.js` starts the API (`APP_ENV=ci`, two-step sign-in **on**), the storefront's production server and `vite preview` of the admin. One worker: the journeys share a database.
- `global-setup.js` signs `e2e-owner` in through the real screens, does the forced two-step set-up and saves the browser state (`.data/e2e/owner.json`) and the authenticator secret (`secrets.json`). `support/admin.js` signs in with a code (a code is used once per 30 s: the last one used is kept in a file).
- Browser: the Chrome on this machine (`E2E_CHANNEL=chromium` for the one Playwright downloads, as CI does). `E2E_WEBKIT=1` adds the smoke set on WebKit (journeys tagged `@staff` are left out there: the staff cookie is Secure and these servers are plain http) (`playwright install webkit` first).

## State, and why the order matters

Journeys run in file order and leave things for later ones (`support/state.js`): E2E-01 places the order that E2E-06, 08 and 11 use. A journey that changes shared things (a price, a theme, Urdu on) is written to be run once per prepared database; **run the whole suite on a fresh `prepare`** (that is what `pnpm test:e2e` does).
Set-up that is not what the journey is about goes through the API as the owner (`support/api.js`: a promo, a stock count); what a journey asserts goes through the screens.

## Things learned

- A choice chip (size, colour) hides its input: press the drawn label (`support/ui.js` `pressChip`). A filter checkbox is controlled: `click()` it and wait for the address, never `check()`.
- Names: a label with a required star is not `exact`; use `getByRole('textbox', { name })` or the field's `name` attribute.
- The shop keeps its settings in memory for 30 s: a saved theme or language shows within that (poll with reloads).
- The session cookie is `Secure`; a Playwright request context does not send it over http, so `support/api.js` sends it by hand.
- Do not write regular expressions with backslashes through the shell here (`cat <<EOF`, `node -e`): use the Edit tool.

## Screen reader (NVDA), not part of `pnpm test:e2e`

`screen-reader/*.sr.spec.js` with `playwright.sr.config.js`: real NVDA on Windows driven by Guidepup (`@guidepup/playwright`), in a headed Firefox, on the same servers. It asserts what NVDA *said*, loosely (never a snapshot of the log: NVDA's wording changes between versions). **Written at M7-09, not yet run**: it needs NVDA installed, which changes the machine and needs an administrator (`npx @guidepup/setup`, then `npx playwright install firefox`). Run: `pnpm --filter @noor/e2e prepare:data && pnpm --filter @noor/e2e test:sr` (if this Playwright's Firefox 155 will not start, "side-by-side configuration is incorrect", set `E2E_FIREFOX` to another Playwright Firefox, e.g. the `firefox-1555` folder). If a phrase differs on a real run, fix the pattern in the test and say so here. TalkBack has no automation: it stays a manual pass (`plan/13-quality.md` §12.1).

# ADR-0006 — Tailwind v4 with three-tier CSS-variable tokens; logical properties only

| Field | Value |
|---|---|
| ID | ADR-0006 |
| Title | Styling and design tokens |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K1, F-21, F-22), ADR-0003, ADR-0007 |
| Decisions used | ADR-0018 |

## Purpose and scope
How styles are authored and how tokens, brand themes and light/dark are layered. The token values themselves live in DOC-04 `tokens.md`.

## Context
Two token systems exist: storefront gold/Playfair, no dark mode (`index.css:1,3-57`); admin burgundy/Instrument Sans with dark mode (`index.css:7-141`). The admin contract already carries a storefront theme (`ThemeTokens`, `admin schemas.js:235-250`) that the admin edits at runtime. Both apps use physical-direction CSS (16 and 18 declarations) which breaks Urdu/RTL (F-22). v2 chose CSS Modules + tokens; the admin uses plain global CSS (35 KB `index.css`).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Tailwind v4 (CSS-first `@theme`) + CSS variables | Matches shadcn-style components (ADR-0007); unused utilities are not shipped; logical utilities (`ms-*`, `ps-*`, `start-*`); agents know it well | Class-heavy markup; build dependency |
| B. CSS Modules + CSS variables (v2 choice) | Plain CSS; scoped | Slower to build many primitives; no ready logical-property utilities; shadcn components would need translating |
| C. vanilla-extract / Panda (typed CSS-in-TS) | Typed tokens | Extra build complexity; smaller agent familiarity |
| D. Keep global CSS | No migration | Two systems stay; no guardrail against physical properties |

## Decision
**Option A. This supersedes v2's "CSS Modules + tokens".**

Three tiers, defined once in `packages/ui/src/tokens.css`:
1. **Primitive** — raw scales (`--gray-50…950`, `--space-1…`, `--radius-*`). Never used directly in components.
2. **Semantic** — what a component uses: `--color-bg`, `--color-surface`, `--color-fg`, `--color-muted`, `--color-line`, `--color-accent`, `--color-on-accent`, `--color-sale`, `--color-success`, `--color-warning`, `--color-danger`, `--color-focus`, plus `--font-heading`, `--font-body`, `--radius-control`, `--radius-card`. Light values on `:root`; dark overrides under `[data-theme="dark"]` and `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`.
3. **Brand** — per-app/per-store overrides on `[data-brand="storefront-gold"]`, `[data-brand="admin-burgundy"]`. Store theme from the API sets semantic variables at request time.

- Tailwind `@theme` maps utilities to the semantic variables (`bg-bg`, `text-fg`, `border-line`).
- **Logical properties only.** Use `ms-/me-/ps-/pe-/start-/end-`, `text-start`, `border-s`. Physical utilities (`ml-`, `pr-`, `left-`, `text-left`) are lint errors (DOC-15 rule `no-physical-direction`). Exceptions are listed in DOC-04.
- Store theme injection: the API returns `ThemeTokens`; the storefront root loader validates every color against `^#[0-9a-f]{6}$` and every font against an allow-list before writing `<style>`; any invalid value falls back to the brand default (prevents CSS injection from admin data).
- Fonts are self-hosted (`@fontsource-variable/*` or files in `public/fonts`), `font-display: swap`, subset by `unicode-range`; no Google Fonts `@import` (F-21).

## Examples
```css
/* packages/ui/src/tokens.css */
@import "tailwindcss";
@theme {
  --color-bg: var(--sem-bg);
  --color-fg: var(--sem-fg);
  --color-accent: var(--sem-accent);
}
:root { --sem-bg: #FBF8F3; --sem-fg: #141210; --sem-accent: #886615; }
[data-theme="dark"] { --sem-bg: #141210; --sem-fg: #F3EEE6; --sem-accent: #E8C766; }
```
(Values are illustrative; DOC-04 holds the real, contrast-checked set. Note the storefront's own comment that `#C9A227` is ~2.3:1 and unsafe for text, `index.css:15`.)

## Consequences
One token vocabulary across apps; dark mode and RTL are properties of the system, not per-page work; existing admin CSS is migrated component by component.

## Rules
**Always:** use semantic tokens; verify 4.5:1 text contrast in both schemes. **Never:** hard-code hex in components; use physical-direction utilities; interpolate admin-supplied strings into CSS without validation. **Common mistake:** using a primitive token directly "just once".

## Acceptance checklist
- [x] `grep -rE "(^|[^-a-z])(ml|mr|pl|pr|left|right)-" apps packages` returns nothing (outside DOC-04 exceptions). (`node scripts/check-logical.mjs`, in `pnpm check`.)
- [x] Both schemes pass axe contrast checks on every shipped component story. (`packages/ui/test/stories.a11y.test.jsx` and `contrast.test.js`.)
- [x] No `@import url(https://fonts.googleapis…)` anywhere. (Run at M7-07: no match; E2E-17 fails on any request to another host.)

## Revisit trigger
Tailwind build or upgrade cost exceeds 2 dev-days twice in 6 months, or admin-driven theming needs more than CSS variables can express.

## Open questions and assumptions
Tailwind v4 specifics were not researched in Phase 0; the first task of Phase 1 verifies the `@theme` syntax against tailwindcss.com before DOC-04 is finalised. Assumes the team accepts utility classes.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed; supersedes v2's CSS Modules choice |
| 2026-10-02 | Phase 1: `@theme` syntax checked; real token set and contrast gate in DOC-04a. Storefront ships light-only in v1 (DOC-04a §6); lint for physical utilities is a script, not an ESLint plugin |
| 2026-10-02 | M0-10: `@theme` syntax verified by compiling tokens.css (Tailwind 4.3.3); the lint for physical utilities is `scripts/check-logical.mjs` over TypeScript and CSS in `packages/ui`, `apps/storefront` and migrated admin files |

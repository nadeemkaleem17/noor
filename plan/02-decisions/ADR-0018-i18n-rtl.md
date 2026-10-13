# ADR-0018 — English at launch, Urdu/RTL-ready from day one

| Field | Value |
|---|---|
| ID | ADR-0018 |
| Title | Internationalisation and RTL |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-14, F-21, F-22), ADR-0006, README A-04 |
| Decisions used | ADR-0005, ADR-0014 |

## Purpose and scope
What "Urdu/RTL-ready" means in code now, and what ships later. Message-catalog workflow detail is DOC-03.

## Context
The storefront hard-codes `<html lang="en">` (`index.html:2`), has no i18n library, shows server English error prose to customers (`utils/api.js:58`), loads Playfair/Inter from Google (`index.css:1`) and uses physical CSS (F-22). Assumption A-04: English at launch, Urdu soon after, so retrofitting must be avoided.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. RTL-ready now (logical CSS, message keys, `dir` from locale), Urdu content later | Cheap now; no rewrite later | Slight discipline cost |
| B. English only, retrofit later | Fastest now | Rewriting every component and string |
| C. Urdu + English at launch | Full coverage | Translation, font and QA cost before launch |

## Decision
**Option A.**
- `dir` and `lang` set on `<html>` from the locale in the root loader; locale from URL prefix (`/ur/…`) with `/` = English; `hreflang` tags in DOC-06 SEO.
- All UI strings are message keys in `packages/i18n` (ICU MessageFormat via one i18n library fixed in DOC-03; default candidate `i18next`-compatible). **No user-visible string literals in components** (lint rule).
- Server errors return stable `code`s (ADR-0005); the UI maps codes to localised messages. Server prose is for logs and developers only.
- Numbers, dates, plurals, currency via `Intl.*` with `en-PK` and `ur-PK`; digits stay Western (0-9) by default for prices.
- Content fields that customers read are localisable in the contract: `title`, `subtitle`, `descriptionMd`, `highlights`, `care`, `alt`, CMS `title`/`bodyMd`, menus; shape `{ en: string, ur?: string }` with `en` required, fallback to `en`. DOC-09 specifies translation tables vs JSONB.
- Fonts: self-hosted, subset with `unicode-range`; Urdu uses a Nastaliq-capable web font loaded **only** on `/ur` pages with `font-display: swap` and a Naskh fallback; budget ≤ 150 kB for the Urdu font on first load (tested in DOC-13).
- Layout: logical properties only (ADR-0006); icons that imply direction (arrows, chevrons) flip via `rtl:` variants; the Base UI RTL spike (ADR-0007) must pass.
- Phone numbers, order numbers and SKUs render LTR inside RTL text via `<bdi>`/`dir="ltr"`.
- WhatsApp message templates exist per locale.

## Examples
```html
<html lang="ur" dir="rtl">
<span>{t("cart.total")}</span> <bdi dir="ltr">RB-10458</bdi>
```

## Consequences
Urdu launch becomes translation + QA work, not engineering. Admin stays English-only in v1 (staff UI), but components are RTL-safe because they are shared.

## Rules
**Always:** use message keys; use logical utilities; test every new component under `dir="rtl"` in Storybook. **Never:** concatenate translated fragments; embed text in images; hard-code `left/right`. **Common mistake:** formatting prices with string templates instead of `formatMoney`.

## Acceptance checklist
- [ ] Switching Storybook to RTL shows no overlapping or mirrored-wrong component. **Open: E2E-16 checks the Urdu shop and the admin in RTL; Storybook was not walked.**
- [ ] Lint finds no JSX string literals in `apps/storefront` and `packages/ui`. **Open.**
- [x] A product with only `en` renders on `/ur` using the fallback without errors. (E2E-16 loads `/ur` pages of products that have only English text.)

## Revisit trigger
Urdu share of traffic over 20%, or Urdu launch date set (then schedule translation and font QA).

## Open questions and assumptions
Assumes A-04. Choice of Urdu font (licence, weight) and i18n library are made in DOC-03/DOC-04. Roman-Urdu *content* is not a locale; it is handled as search synonyms (ADR-0010).

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Phase 1: library fixed as i18next + react-i18next + i18next-icu, `remix-i18next` for SSR with a spike (DOC-03 §9); Urdu font Noto Nastaliq Urdu (DOC-04a §7) |
| 2026-10-02 | M0-12: `remix-i18next` not used; per-request `createI18n` in `@noor/i18n` (DOC-03 §9). Formatters `formatMoney`, `formatDate`, `formatNumber` are in `@noor/i18n` with `numberingSystem: latn` via the `-u-nu-latn` tag; dates use `Asia/Karachi` |

# 04a — Design System: Tokens and Theming

| Field | Value |
|---|---|
| ID | DOC-04a |
| Title | Tokens, brand themes, light/dark, fonts |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K1, F-21, F-22), DOC-03 |
| Decisions used | ADR-0006, ADR-0007, ADR-0018 |

## 1. Purpose and scope

**Governs:** every design token, how themes and colour schemes switch, how a store theme from the API becomes CSS, fonts, and the contrast gate.
**Does not govern:** component APIs (DOC-04b), layout and interaction patterns (DOC-04c), which theme a store uses (DOC-07 appearance).

One file, `packages/ui/src/tokens.css`, is the only place a colour, size, radius, shadow or duration is defined. It replaces `admin-panel/src/index.css:7-141` and `ecommerce-website/src/index.css:3-57` (K1).

## 2. Three tiers

| Tier | Prefix | Used by | Example |
|---|---|---|---|
| Primitive | `--p-*` | The semantic tier only | `--p-space-4: 16px` |
| Semantic | `--sem-*` | Mapped to Tailwind utilities through `@theme`; components use the **utility**, not the variable | `--sem-fg` → `text-fg` |
| Brand | set on `[data-brand]` / inline `<style>` | Overrides `--sem-*` values | `[data-brand="admin-burgundy"]` |

Tailwind's default colour palette is switched off (`--color-*: initial`), so `bg-red-500` does not exist and cannot be used by mistake.

## 3. Semantic colour tokens

| Utility name | Variable | Role |
|---|---|---|
| `bg` | `--sem-bg` | Page background |
| `surface` | `--sem-surface` | Cards, inputs, popovers |
| `surface-2` | `--sem-surface-2` | Subtle fills: table header, hover row, skeleton |
| `fg` | `--sem-fg` | Primary text and icons |
| `fg-soft` | `--sem-fg-soft` | Secondary text |
| `muted` | `--sem-muted` | Tertiary text, placeholders, help text (still ≥ 4.5:1) |
| `line` | `--sem-line` | Decorative dividers, card borders |
| `line-strong` | `--sem-line-strong` | Input, checkbox and other control borders (≥ 3:1, WCAG 1.4.11) |
| `accent` | `--sem-accent` | Filled primary button, selected state |
| `on-accent` | `--sem-on-accent` | Text/icon on `accent` |
| `accent-text` | `--sem-accent-text` | Accent-coloured **text** and links on `bg`/`surface` |
| `accent-soft` | `--sem-accent-soft` | Selected-row / chip background |
| `sale` | `--sem-sale` | Sale price, discount badge text |
| `success` `warning` `danger` | `--sem-success` … | Status text and icons |
| `success-soft` `warning-soft` `danger-soft` | `--sem-success-soft` … | Status backgrounds (text on them is `fg`) |
| `focus` | `--sem-focus` | Focus ring |

`accent` and `accent-text` are separate because the storefront gold `#C9A227` is about 2.3:1 on cream and cannot be text (storefront `index.css:15`).

## 4. Values (contrast-checked)

Ratios were computed with the WCAG 2.x formula on 2 Oct 2026 by `packages/ui/scripts/check-contrast.mjs` (§9). Text tokens must be ≥ 4.5:1 on `bg`, `surface` and `surface-2`; `line-strong` and `focus` ≥ 3:1.

### 4.1 `admin-burgundy` (admin; light and dark)

| Token | Light | Dark | Lowest text ratio (light / dark) |
|---|---|---|---|
| bg | `#FBF9F6` | `#15130F` | |
| surface | `#FFFFFF` | `#1E1B17` | |
| surface-2 | `#F5F1EB` | `#28241E` | |
| fg | `#231F1C` | `#EDE7DF` | 14.53 / 12.56 |
| fg-soft | `#4A433D` | `#B8AFA3` | 8.64 / 7.12 |
| muted | `#6B625C` | `#9F978D` | 5.29 / 5.35 |
| line | `#E7E0D8` | `#3A342B` | decorative |
| line-strong | `#8C8279` | `#857C72` | 3.34 / 3.76 |
| accent | `#7A2E3A` | `#C97F8C` | |
| on-accent | `#FFFFFF` | `#1C1211` | 9.21 / 6.03 on accent |
| accent-text | `#7A2E3A` | `#D99AA5` | 8.19 / 6.70 |
| accent-soft | `#F4E7E9` | `#3A2429` | |
| sale | `#B23A3A` | `#E17B7B` | 5.24 / 5.38 |
| success | `#2F6B47` | `#6FBE8C` | 5.63 / 6.92 |
| warning | `#855B1A` | `#E0AD5C` | 5.32 / 7.57 |
| danger | `#B23A3A` | `#E17B7B` | 5.24 / 5.38 |
| success-soft / warning-soft / danger-soft | `#E8F1EA` / `#FBF1E1` / `#FBEAEA` | `#1E2E23` / `#332A19` / `#35201F` | |
| focus | `#2C3E8C` | `#7C8FE8` | 9.19 / 5.68 |

Changes from the current admin CSS, each made to pass the gate: `muted` `#756C66` → `#6B625C`; `success` `#3F7D58` → `#2F6B47`; `warning` `#B8863B` → `#855B1A` (light only). Dark values are unchanged except the new `accent-text`.

The admin sidebar keeps its own four tokens (`--sem-sidebar-bg` `#1C1918`/`#0F0D0A`, `-fg` `#EFE9E2`/`#EDE7DF`, `-muted` `#9C9188`/`#8F8579`, `-active` `#2A2523`/`#1E1B17`); they exist only under `[data-brand="admin-burgundy"]`.

### 4.2 Storefront presets (light)

| Token | `storefront-gold` (default) | `monochrome` | `botanical` |
|---|---|---|---|
| bg | `#FBF8F3` | `#FFFFFF` | `#F6F3EA` |
| surface | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| surface-2 | `#F4EFE6` | `#F4F3F1` | `#EFF3EA` |
| fg | `#141210` | `#141210` | `#23281F` |
| fg-soft | `#3D3832` | `#3D3832` | `#3A4136` |
| muted | `#6A6359` (5.18) | `#6B6B6B` (4.81) | `#5F6858` (5.18) |
| line | `#E7E0D4` | `#DEDCD8` | `#DCE3D4` |
| line-strong | `#8C8279` | `#8C8279` | `#8C8279` |
| accent | `#C9A227` | `#221F1C` | `#3F5A46` |
| on-accent | `#1A1408` (7.57) | `#FFFFFF` (16.40) | `#FFFFFF` (7.60) |
| accent-text | `#806010` (5.10) | `#221F1C` | `#3F5A46` (6.85) |
| accent-soft | `#FBF6E8` | `#F4F3F1` | `#EFF3EA` |
| sale | `#B23A2E` (5.18) | `#B23A2E` (5.94) | `#A04A22` (5.34) |
| success / warning / danger | `#2F6B40` / `#855B1A` / `#B23A2E` | same | same |
| focus | `#2C3E8C` | `#2C3E8C` | `#2C3E8C` |

Numbers in brackets are the lowest ratio across `bg`/`surface`/`surface-2`. Changes from the current storefront CSS: `--gold-text` `#886615` → `#806010`; `--stone`/`--panel-muted` → the `muted` values above (botanical `#7C8574` was 3.46:1); botanical `--sale` `#B2582F` (4.37:1) → `#A04A22`.

### 4.3 Storefront dark (reserved, not shipped in v1)

`storefront-gold` dark set, already checked: bg `#141210`, surface `#1E1B17`, surface-2 `#28241E`, fg `#F3EEE6`, fg-soft `#C9C1B5`, muted `#A39B8F` (5.61), line `#3A342B`, line-strong `#857C72`, accent `#C9A227`, on-accent `#1A1408`, accent-text `#E8C766` (9.40), sale/danger `#EE8377` (5.99), success `#6FBE8C`, warning `#E0AD5C`, focus `#8FA0F0` (6.91). See §6 for why it is off.

## 5. Non-colour tokens

| Group | Tokens |
|---|---|
| Spacing (4 px base; Tailwind's numeric scale `p-1`=4 px … is kept as is) | Allowed steps: `0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24` (2 px … 96 px). Other values need a DOC-04 changelog row |
| Radius | `--radius-control` (buttons, inputs, chips), `--radius-card` (cards, dialogs, popovers), `--radius-media` (product images), `rounded-full` (avatars, pills) |
| Radius values | From `ThemeTokens.radius`: control `sharp` 0 / `soft` 6 px / `round` 9999 px; card `sharp` 0 / `soft` 10 px / `round` 16 px; media `none` 0 / `soft` 8 px. Admin fixed: control 6 px, card 10 px |
| Shadow | `shadow-card` `0 1px 2px rgb(35 31 28 / 0.06)`; `shadow-pop` `0 12px 32px rgb(28 25 24 / 0.16)`; `shadow-modal` `0 24px 64px rgb(20 16 14 / 0.28)`. Dark: alphas 0.4 / 0.5 / 0.6 on black |
| Type scale (rem) | `text-xs` 0.6875 (11 px) · `text-sm` 0.8125 (13) · `text-base` 0.875 (14, admin body) · `text-md` 1 (16, storefront body) · `text-lg` 1.25 (20) · `text-xl` 1.75 (28) · `text-2xl` 2.25 (36) · `text-3xl` 3 (48, storefront hero only) |
| Line height | `leading-tight` 1.2 (headings), `leading-normal` 1.5 (body), `leading-urdu` 2.1 (Nastaliq needs the vertical room; applied by `:lang(ur)`) |
| Font weight | 400, 500, 600. 700 only for storefront headings |
| Fonts | `--font-heading`, `--font-body`, `--font-mono` (§7) |
| Motion | `--dur-micro` 120 ms, `--dur-small` 200 ms, `--dur-modal` 320 ms, `--dur-modal-close` 200 ms; `--ease-out` `cubic-bezier(0.16,1,0.3,1)`, `--ease-in` `cubic-bezier(0.7,0,0.84,0)`. All durations become 0 ms under `prefers-reduced-motion: reduce` |
| Z-index | `z-base` 0, `z-sticky` 20, `z-header` 30, `z-drawer` 40, `z-modal` 50, `z-popover` 60, `z-toast` 70. No other z-index values |
| Breakpoints (mobile-first, min-width) | `sm` 480 px, `md` 768 px, `lg` 1024 px, `xl` 1280 px. Storefront is designed at 360 px first |
| Density (storefront, `ThemeTokens.density`) | `comfortable`: control height 44 px, grid gap `4`; `compact`: control height 40 px, grid gap `3`. Admin: control height 36 px, table row 44 px |
| Media ratio | `--media-ratio` from `ThemeTokens.mediaRatio` (`3/4` default); product images use `aspect-(--media-ratio)` |
| Touch target | Minimum 44 × 44 px on the storefront, 36 × 36 px in the admin (pointer devices), enforced by component heights |

## 6. Themes and colour schemes

| App | Brand | Schemes |
|---|---|---|
| Admin | `data-brand="admin-burgundy"` in `index.html` | Light and dark. `data-theme="light" \| "dark"` on `<html>`; with no attribute it follows `prefers-color-scheme`. Preference stored in `noor.admin.prefs` (DOC-03 §6); set before first paint by a 5-line inline script in `index.html` |
| Storefront | Store theme from the API (`StoreConfig.theme`, contract `ThemeTokens`) | **Light only in v1**: `<html data-theme="light">` always |

Why the storefront is light-only: `ThemeTokens` carries one colour set, so an admin-customised theme has no dark values, and inventing them automatically risks unreadable product pages. Dark becomes available when `ThemeTokens.colorsDark` (optional, same shape) is added; presets get the §4.3 values. Revisit trigger: the owner asks for it, or more than 30% of storefront sessions report `prefers-color-scheme: dark` in analytics (DOC-13).

**Store theme injection** (root loader → inline `<style>`, ADR-0006):

```ts
// apps/storefront/app/features/layout/server/theme.server.ts
const HEX = /^#[0-9a-f]{6}$/i
const FONTS = ['Playfair Display', 'Inter', 'Instrument Sans'] as const // = the fonts we self-host (§7)
const RADIUS = { control: { sharp: '0', soft: '6px', round: '9999px' },
                 card: { sharp: '0', soft: '10px', round: '16px' }, media: { none: '0', soft: '8px' } }

export function themeCss(theme: ThemeTokens, fallback = storefrontGold): string {
  const color = (k: keyof ThemeTokens['colors']) => (HEX.test(theme.colors[k] ?? '') ? theme.colors[k] : fallback.colors[k])
  const font = (v: string, d: string) => (FONTS.includes(v as never) ? v : d)
  return `:root{--sem-bg:${color('bg')};--sem-surface:${color('surface')};--sem-fg:${color('fg')};` +
    /* …one line per colour key… */
    `--sem-font-heading:"${font(theme.fonts.heading, 'Playfair Display')}",serif;` +
    `--sem-radius-control:${RADIUS.control[theme.radius.control]};--media-ratio:${theme.mediaRatio};}`
}
```

Only values that pass the regex, the allow-list or an enum lookup reach the CSS; anything else falls back. No admin-supplied string is ever interpolated raw.

`ThemeTokens.colors` has 12 required keys; the semantic tokens it lacks are derived in `deriveColors()` and emitted as literal hex (so the CSS and the contrast gate see identical values): `surface-2` = 4% of `fg` mixed into `bg`, `accent-soft` = 10% of `accent`, `fg-soft` = 80% of `fg`, `line-strong` = 50% of `fg`, status `-soft` backgrounds = 12% of the status color, `accent-text` = `accent` when its contrast on `bg` is ≥ 4.5, otherwise `fg`, `on-accent` = white or black, whichever contrasts more. The admin Appearance page runs the same contrast function and blocks saving a theme whose `fg`, `muted` or `sale` fails 4.5:1 on `bg` (DOC-07).

## 7. Fonts

| Use | Family | Package | Loaded |
|---|---|---|---|
| Storefront headings | Playfair Display (variable) | `@fontsource-variable/playfair-display` | `latin` subset, preload the 600 weight file |
| Storefront body | Inter (variable) | `@fontsource-variable/inter` | `latin` subset, preload |
| Admin UI | Instrument Sans | `@fontsource/instrument-sans` (400, 500, 600) | already installed |
| Numbers, SKUs, order numbers | IBM Plex Mono | `@fontsource/ibm-plex-mono` (400, 500) | admin only; storefront uses `font-variant-numeric: tabular-nums` on the body font |
| Urdu | Noto Nastaliq Urdu (OFL-1.1) | `@fontsource/noto-nastaliq-urdu` | Only on `/ur` routes; fallback stack `"Noto Naskh Arabic", Tahoma, sans-serif` |

All `font-display: swap`. No request to `fonts.googleapis.com` or `fonts.gstatic.com` (F-21). Adding a font = add the package, add it to `FONTS` in §6 and to this table.

## 8. `tokens.css` (reference implementation)

```css
/* packages/ui/src/tokens.css */
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --color-*: initial;                 /* remove Tailwind's default palette */
  --color-bg: var(--sem-bg);
  --color-surface: var(--sem-surface);
  --color-surface-2: var(--sem-surface-2);
  --color-fg: var(--sem-fg);
  --color-fg-soft: var(--sem-fg-soft);
  --color-muted: var(--sem-muted);
  --color-line: var(--sem-line);
  --color-line-strong: var(--sem-line-strong);
  --color-accent: var(--sem-accent);
  --color-on-accent: var(--sem-on-accent);
  --color-accent-text: var(--sem-accent-text);
  --color-accent-soft: var(--sem-accent-soft);
  --color-sale: var(--sem-sale);
  --color-success: var(--sem-success);
  --color-success-soft: var(--sem-success-soft);
  --color-warning: var(--sem-warning);
  --color-warning-soft: var(--sem-warning-soft);
  --color-danger: var(--sem-danger);
  --color-danger-soft: var(--sem-danger-soft);
  --color-focus: var(--sem-focus);
  --color-transparent: transparent;
  --color-current: currentColor;

  --font-heading: var(--sem-font-heading);
  --font-body: var(--sem-font-body);
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --radius-control: var(--sem-radius-control);
  --radius-card: var(--sem-radius-card);
  --radius-media: var(--sem-radius-media);

  --shadow-card: 0 1px 2px rgb(35 31 28 / 0.06);
  --shadow-pop: 0 12px 32px rgb(28 25 24 / 0.16);
  --shadow-modal: 0 24px 64px rgb(20 16 14 / 0.28);

  --breakpoint-*: initial;
  --breakpoint-sm: 30rem; --breakpoint-md: 48rem; --breakpoint-lg: 64rem; --breakpoint-xl: 80rem;
}

/* ---- brand: admin ---- */
[data-brand="admin-burgundy"] {
  --sem-bg: #FBF9F6; --sem-surface: #FFFFFF; --sem-surface-2: #F5F1EB;
  --sem-fg: #231F1C; --sem-fg-soft: #4A433D; --sem-muted: #6B625C;
  --sem-line: #E7E0D8; --sem-line-strong: #8C8279;
  --sem-accent: #7A2E3A; --sem-on-accent: #FFFFFF; --sem-accent-text: #7A2E3A; --sem-accent-soft: #F4E7E9;
  --sem-sale: #B23A3A; --sem-success: #2F6B47; --sem-warning: #855B1A; --sem-danger: #B23A3A;
  --sem-success-soft: #E8F1EA; --sem-warning-soft: #FBF1E1; --sem-danger-soft: #FBEAEA;
  --sem-focus: #2C3E8C;
  --sem-font-heading: "Instrument Sans", system-ui, sans-serif;
  --sem-font-body: "Instrument Sans", system-ui, sans-serif;
  --sem-radius-control: 6px; --sem-radius-card: 10px; --sem-radius-media: 8px;
  color-scheme: light;
}
```

The dark block must not be duplicated by hand as it is today (`admin index.css:80-141` repeats 27 lines). The dark values are defined once under `[data-theme="dark"]`, and a 5-line inline script in `index.html` always resolves the OS preference into an explicit `data-theme` attribute before first paint, so no `@media` copy is needed:

```html
<script>
  try { var p = JSON.parse(localStorage.getItem('noor.admin.prefs') || '{}').theme } catch (e) {}
  document.documentElement.dataset.theme = p === 'light' || p === 'dark' ? p
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
</script>
```

```css
[data-brand="admin-burgundy"][data-theme="dark"] {
  --sem-bg: #15130F; --sem-surface: #1E1B17; --sem-surface-2: #28241E;
  --sem-fg: #EDE7DF; --sem-fg-soft: #B8AFA3; --sem-muted: #9F978D;
  --sem-line: #3A342B; --sem-line-strong: #857C72;
  --sem-accent: #C97F8C; --sem-on-accent: #1C1211; --sem-accent-text: #D99AA5; --sem-accent-soft: #3A2429;
  --sem-sale: #E17B7B; --sem-success: #6FBE8C; --sem-warning: #E0AD5C; --sem-danger: #E17B7B;
  --sem-success-soft: #1E2E23; --sem-warning-soft: #332A19; --sem-danger-soft: #35201F;
  --sem-focus: #7C8FE8;
  color-scheme: dark;
}

/* ---- brand: storefront default (overridden by the injected store theme) ---- */
[data-brand="storefront"] {
  --sem-bg: #FBF8F3; --sem-surface: #FFFFFF; --sem-surface-2: #F4EFE6;
  --sem-fg: #141210; --sem-fg-soft: #3D3832; --sem-muted: #6A6359;
  --sem-line: #E7E0D4; --sem-line-strong: #8C8279;
  --sem-accent: #C9A227; --sem-on-accent: #1A1408; --sem-accent-text: #806010; --sem-accent-soft: #FBF6E8;
  --sem-sale: #B23A2E; --sem-success: #2F6B40; --sem-warning: #855B1A; --sem-danger: #B23A2E;
  --sem-success-soft: #E8F1EA; --sem-warning-soft: #FBF1E1; --sem-danger-soft: #FBEAEA;
  --sem-focus: #2C3E8C;
  --sem-font-heading: "Playfair Display", Georgia, serif;
  --sem-font-body: "Inter", system-ui, sans-serif;
  --sem-radius-control: 6px; --sem-radius-card: 10px; --sem-radius-media: 0; --media-ratio: 3/4;
  color-scheme: light;
}

:lang(ur) { --sem-font-heading: "Noto Nastaliq Urdu", "Noto Naskh Arabic", Tahoma, sans-serif;
            --sem-font-body: "Noto Nastaliq Urdu", "Noto Naskh Arabic", Tahoma, sans-serif; line-height: 2.1; }

@layer base {
  html { background: var(--sem-bg); color: var(--sem-fg); font-family: var(--sem-font-body); }
  :focus-visible { outline: 2px solid var(--sem-focus); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0s !important; transition-duration: 0s !important; } }
}
```

All three storefront presets (`storefront-gold`, `monochrome`, `botanical`) are `ThemeTokens` objects in `packages/contract/src/theme-presets.ts`, applied through the same injection path as a custom theme (`themeCss()` in `@noor/ui/theme`, used by the storefront root loader and the admin preview). `ThemeTokens.colors` accepts optional overrides for the derived colors (`surface2`, `fgSoft`, `lineStrong`, `accentText`, `accentSoft`); presets set them so brand colors such as the dark-gold accent text are kept, while a custom theme leaves them out and gets derived, readable values.

Because every colour utility resolves to a variable that the theme switches, **components never use the `dark:` variant.** It exists only for the rare asset swap (a logo with light and dark files).

## 9. The contrast gate

The gate is `packages/ui/test/contrast.test.ts` (it runs in `pnpm test`, so `pnpm check` includes it). It uses the WCAG formula in `packages/ui/src/contrast.ts`, reads the token blocks from `tokens.css` and the presets from the contract, and fails if any pair in this list is below its threshold:

| Pair | Threshold |
|---|---|
| `fg`, `fg-soft`, `muted`, `accent-text`, `sale`, `success`, `warning`, `danger` on each of `bg`, `surface`, `surface-2` | 4.5 |
| `on-accent` on `accent` | 4.5 |
| `fg` on `success-soft`, `warning-soft`, `danger-soft`, `accent-soft` | 4.5 |
| `line-strong`, `focus` on `bg`, `surface` | 3.0 |

The same functions are exported from `@noor/ui/contrast` for the admin Appearance page (§6). The test also asserts that the storefront block of `tokens.css` equals the `storefront-gold` preset, so the two cannot drift.

## 10. Logical properties

Only logical utilities: `ms- me- ps- pe- start- end- border-s border-e rounded-s rounded-e text-start text-end`. Physical ones are a CI failure through `scripts/check-logical.mjs`, which greps `apps/` and `packages/` for `\b(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-` in `className` strings and for `margin-left|margin-right|padding-left|padding-right|(^|[^-])left:|(^|[^-])right:` in `.css` files.

Allowed exceptions (each needs the comment `/* physical: <reason> */` on the same line, which the script skips):

| Exception | Reason |
|---|---|
| `left-1/2 -translate-x-1/2` centring | Symmetric; identical in RTL |
| Carousel/gallery scroll offsets computed in JS | Use `scrollLeft` with the sign handled in `useCarousel` (DOC-04b) |
| Phone number, order number, price inputs | Always LTR; wrapped in `dir="ltr"` |

Directional icons (chevrons, arrows, "back") flip with `rtl:-scale-x-100`. Icons that are not directional (search, cart, check) never flip.

## 11. Rules

**Always:** use a semantic utility (`bg-surface`, `text-muted`); add a token here before using a new value; run the contrast script after changing any colour.
**Never:** write a hex, `rgb()`, px radius or raw duration in a component; use a `--p-*` or `--sem-*` variable directly in a component (use the utility); use `dark:` for colours; use arbitrary values like `p-[13px]` or `text-[#333]`.
**Common mistakes:** using `accent` for text on the storefront (gold fails contrast; use `accent-text`); using `line` for an input border (fails 3:1; use `line-strong`); adding a second "muted" grey.

## 12. Acceptance checklist

- [x] `packages/ui/src/tokens.css` is the only file in the repo containing a hex colour, apart from `theme-presets.ts`, SVG assets and tests (`grep -rnE "#[0-9a-fA-F]{6}" apps packages`). (Run at M7-07: the other files are the theme presets and colour maths of `@noor/contract`, the seed's generated pictures, the image processor's background, and the admin colour pickers (a fallback value).)
- [x] The contrast gate passes (`packages/ui/test/contrast.test.js`, in `pnpm test`). (The contrast gate is `packages/ui/test/contrast.test.js` (there is no script of that name).)
- [x] `node scripts/check-logical.mjs` passes. (Run at M7-07.)
- [x] `grep -rn "dark:" apps packages/ui/src/components` returns only asset swaps. (Run at M7-07: the one match is an object key (`dark: Moon`).)
- [x] No network request to a Google Fonts host on any page (Playwright assertion, DOC-13). (E2E-17 fails on any request to another host.)
- [x] A store theme with `colors.accent = "red;}body{display:none"` renders with the default accent (unit test for `themeCss`). (`packages/ui/test/contrast.test.js` ("a hostile theme").)

## 13. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-04a-1 | Size of Noto Nastaliq Urdu woff2 | Not measured; ADR-0018 budget is 150 kB | Measured over budget → subset to the Urdu block with `unicode-range` or switch to a Naskh face for body text |
| Q-04a-2 | "Admin Panel Elite UI Design System v1" document | Not available in the repo; admin values come from `admin-panel/src/index.css` | The document is supplied and disagrees |
| Q-04a-3 | Tailwind `@theme inline` and `--color-*: initial` | **Confirmed at M0-10** by `packages/ui/test/tailwind.test.ts`, which compiles `tokens.css` with Tailwind 4.3.3: semantic utilities resolve to the `--sem-*` variables, `bg-red-500` does not exist, logical utilities exist, our breakpoints and z-index utilities work | — |
| Q-04a-4 | Storefront dark mode | Off in v1 (§6) | Trigger in §6 |

## 14. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 1). Seven colour values changed from the current CSS to pass the contrast gate (§4) |
| 2026-10-02 | M0-10: `tokens.css` implemented as written, with these changes: the `@theme` block is split (colors, radii, shadows and fonts are `inline` and point at `--sem-*`; text sizes, leading, breakpoints and easing are plain `@theme`); durations are plain `:root` variables; z-index is six `@utility` rules; `--sem-shadow-*` per brand/scheme replaces fixed shadow values; `--control-h` is set per brand and by density. Q-04a-3 confirmed. Contrast gate is a Vitest test, not a script. Presets are all in the contract and `themeCss` is in `@noor/ui/theme` |
| 2026-10-02 | M2-01: `--control-text` added next to `--control-h` (admin `--text-base`, storefront `--text-md`) |

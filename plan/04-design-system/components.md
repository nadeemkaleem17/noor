# 04b — Design System: Components

| Field | Value |
|---|---|
| ID | DOC-04b |
| Title | Primitive components: props, variants, states, accessibility, keyboard, RTL, stories, tests |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-04a, DOC-03 |
| Decisions used | ADR-0006, ADR-0007, ADR-0013, ADR-0018 |

## 1. Purpose and scope

**Governs:** the public API and behaviour of every component in `packages/ui` (`@noor/ui`). An app may only build UI from these plus its own feature components composed from them.
**Does not govern:** tokens (DOC-04a), when to use which component (DOC-04c), feature components such as `ProductCard` or `OrderTimeline` (DOC-06, DOC-07).

What it replaces: admin `components/ui.jsx`, `Field.jsx`, `Toast.jsx`, `TabBar.jsx`, `ImageUpload.jsx` and seven `@radix-ui/*` packages; storefront `components/ui.jsx`, `Skeletons.jsx`, `CtaLink.jsx`.

## 2. Contract every component follows

| Aspect | Rule |
|---|---|
| File | `packages/ui/src/components/<kebab-name>.tsx`, one component family per file; export map entry `@noor/ui/<kebab-name>` |
| Base | Interactive behaviour comes from `@base-ui/react` where a matching primitive exists (column "Base" in §4). Nothing in an app imports Base UI directly |
| Props | Native element props pass through (`...props` onto the root); `className` is merged last with `cn()` (`clsx` + `tailwind-merge`); `ref` is a normal prop (React 19, no `forwardRef`) |
| Composition | Base UI `render` prop for polymorphism (`<Button render={<Link to="/cart" />}>`). No `asChild`, no `as` |
| Variants | `variant` and `size` props implemented with a plain object lookup (`const sizes = { sm: '…', md: '…' }`); no variant library |
| Strings | Built-in labels ("Close", "Loading", "Remove") come from `@noor/i18n` `common` namespace; every such label can be overridden by a prop |
| States | Every interactive component has, and has a story for: default, hover, focus-visible, active, disabled, loading (where it can load), invalid (where it takes input) |
| Focus | Visible ring from the `:focus-visible` base rule (DOC-04a §8); never `outline-none` without a replacement |
| Sizes | Storefront default `md` = 44 px high; admin default `sm` = 36 px. The default comes from `data-brand` through a `--control-h` variable, so the same `<Button>` is the right size in each app |
| RTL | Logical utilities only; directional icons flip (DOC-04a §10); overlays read direction from `DirectionProvider` |
| Motion | Enter/exit use `--dur-*` tokens and Base UI's `data-starting-style` / `data-ending-style` attributes; nothing animates under reduced motion |
| Server rendering | Every component renders on the server without touching `window`; ids via `useId` |

**Definition of done for a component** (reviewed against this list):
1. Props table in this document matches the code.
2. Stories: one per variant and per state, plus an `RTL` story (rendered inside `dir="rtl"` with Urdu sample text) and a `Dark` story (admin brand).
3. `@storybook/addon-a11y` reports no violations on every story (run by `@storybook/addon-vitest` in CI).
4. One interaction test per keyboard row in its keyboard map (Vitest browser mode through the Storybook addon, `play` functions).
5. No hex, no physical direction utility, no string literal.

## 3. Shared prop vocabulary

| Prop | Type | Meaning everywhere |
|---|---|---|
| `variant` | component-specific union | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | Height 36 / 44 / 52 px |
| `tone` | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | Semantic colour |
| `disabled` | `boolean` | Not focusable, `aria-disabled`, 50% opacity |
| `loading` | `boolean` | Shows `Spinner`, sets `aria-busy`, blocks activation, **keeps width** |
| `invalid` | `boolean` | Error styling + `aria-invalid`; set automatically inside `Field` |
| `open` / `defaultOpen` / `onOpenChange` | controlled / uncontrolled pair | All overlays |
| `value` / `defaultValue` / `onValueChange` | controlled / uncontrolled pair | All inputs that are not native |

## 4. Component catalogue

### 4.1 Actions

| Component | Base | Props (beyond §3) | Notes |
|---|---|---|---|
| `Button` | native `<button>` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'link'`, `size`, `loading`, `iconStart`, `iconEnd`, `fullWidth`, `type` (default `'button'`) | `primary` = `bg-accent text-on-accent`. One `primary` per view. `link` variant uses `text-accent-text` |
| `IconButton` | native `<button>` | `label: string` (**required**, becomes `aria-label` and `title`), `icon: ReactNode` (required), `variant`, `size` | Square; minimum 44 px hit area on storefront even when the icon is 20 px |
| `LinkButton` | — | Same as `Button` plus `href` | Renders the app's router link through `render`; external `href` gets `rel="noopener noreferrer"`. Only `http(s):`, `/`, `mailto:`, `tel:` and `https://wa.me/` hrefs render; anything else renders nothing (replaces `safeHref`, storefront `utils/api.js:64-74`) |

### 4.2 Form controls

| Component | Base | Props | Notes |
|---|---|---|---|
| `Field` | Base UI `Field` | `label`, `hint?`, `error?`, `required?`, `children` | Wires `htmlFor`, `aria-describedby`, `aria-invalid`. Every control below is used inside a `Field` (or `RHFField`, DOC-05 §2) |
| `Input` | Base UI `Input` | native props, `size`, `invalid`, `prefix?`, `suffix?` (the border sits on a wrapper when either is given) | `inputMode` and `autoComplete` are required props for phone, email, name and address fields (DOC-04c §3) |
| `Textarea` | native, through `Field.Control` | native props, `invalid`, `autoGrow?` (CSS `field-sizing`) | Props go on the rendered `<textarea>` (Base UI types `Field.Control` for inputs only) |
| `NativeSelect` | native `<select>`, through `Field.Control` | `options: {value,label,disabled?}[]`, `placeholder?`, `size`, `invalid` | Default select on the storefront: the OS picker is best on Android |
| `Select` | Base UI `Select` | `options`, `value`, `onValueChange`, `placeholder` | Admin, or when options need icons/swatches |
| `Combobox` | Base UI `Combobox` | `options` or `onSearch(query) => Promise<Option[]>`, `value`, `onValueChange`, `multiple?`, `emptyText` | City picker, category picker, product search. Async mode debounces 250 ms |
| `Checkbox` | Base UI `Checkbox` | `checked`, `onCheckedChange`, `indeterminate?`, `label` | |
| `RadioGroup` | Base UI `RadioGroup` | `options`, `value`, `onValueChange`, `orientation` | Payment and shipping method pickers use the `card` variant (whole row clickable) |
| `Switch` | Base UI `Switch` | `checked`, `onCheckedChange`, `label` | Settings that apply immediately. Never inside a form that has a Save button (use `Checkbox`) |
| `NumberInput` | Base UI `NumberField` | `value: number \| null`, `onValueChange`, `min`, `max`, `step`, `aria-label` (needed outside a `Field`) | Integer by default |
| `MoneyInput` | `NumberInput` | `value: Money \| null`, `onValueChange(Money \| null)` | User types rupees; the component converts to integer paisa with `parseRupees` from `@noor/contract` (string arithmetic, no float; `6,990.5` gives `699050`) and never exposes a float (ADR-0013). Text that is not an amount gives `null` and `aria-invalid`. Prefix `currencyLabel` (default `Rs`); `dir="ltr"` |
| `PhoneInput` | `Input` | `value: string` (E.164, `+923001234567`), `onValueChange` | Accepts `03001234567`, `3001234567`, `+92…`, `0092…`; normalises on blur; `inputMode="tel"`, `autoComplete="tel"`, `dir="ltr"`. Validation schema `PkMobile` lives in `@noor/contract` (F-06) |
| `QuantityStepper` | Base UI `NumberField` | `value`, `onValueChange`, `min` (default 1), `max` (available stock), `label?` (accessible name, default "Quantity") | Buttons 44 px; at `max` the plus button is disabled and a `max` message is announced politely |
| `OptionChips` | Base UI `ToggleGroup` | `options: {value,label,disabled?,swatch?}[]`, `value`, `onValueChange` | Size and colour pickers on the PDP. A sold-out option is `aria-disabled` with a strike-through but **stays focusable** so "notify me" can attach to it |
| `ImageUpload` | native file input | `value: MediaRef[]`, `onChange`, `multiple`, `maxFiles`, `accept` | Admin only. Drag-and-drop plus button; shows per-file progress and error; upload itself is injected (`upload: (file) => Promise<MediaRef>`) so the package stays free of data fetching |

### 4.3 Overlays

| Component | Base | Props | Notes |
|---|---|---|---|
| `Dialog` | Base UI `Dialog` | `open`, `onOpenChange`, `title` (**required**), `description?`, `size: 'sm' \| 'md' \| 'lg'`, `footer?` | Focus trapped; returns focus to the trigger; `Esc` and backdrop close unless `dismissible={false}` |
| `ConfirmDialog` | Base UI `AlertDialog` | `title`, `body`, `confirmLabel`, `tone: 'danger' \| 'accent'`, `onConfirm: () => Promise<void> \| void`, `confirmText?` | Backdrop does **not** close. While `onConfirm` is pending the confirm button is `loading`. `confirmText` makes the user type a word (used for destructive bulk actions) |
| `Drawer` | Base UI `Dialog` | Same as `Dialog` plus `side: 'end' \| 'bottom'` | `end` slides from the inline-end edge (right in LTR, left in RTL). On viewports under `md` every drawer is `bottom` |
| `Popover` | Base UI `Popover` | `trigger`, `children`, `side`, `align` | `side`/`align` take logical values (`inline-start`, `inline-end`, `top`, `bottom`) |
| `Menu` | Base UI `Menu` | `trigger`, `items: {label, icon?, onSelect, tone?, disabled?}[]` or children | |
| `Tooltip` | Base UI `Tooltip` | `content`, `children`, `delay` (default **300 ms**, set explicitly; Base UI's own default is shorter, ADR-0007) | Never the only way to learn something; not shown on touch |
| `Toast` | Base UI `Toast` | `useToast().push({ title, description?, tone, action?, duration? })` | Default 5 s, `danger` 8 s, with an action: stays until dismissed. Max 3 visible. Region is `aria-live="polite"`, `danger` toasts `assertive` |

### 4.4 Navigation and disclosure

| Component | Base | Props | Notes |
|---|---|---|---|
| `Tabs` | Base UI `Tabs` | `items: {value,label,count?}[]`, `value`, `onValueChange` | When tabs represent URL state the caller binds `value` to a search param |
| `Accordion` | Base UI `Accordion` | `items: {id,title,content}[]`, `multiple?` | PDP details, FAQ, mobile filter groups |
| `Breadcrumb` | native `<nav>` | `items: {label, href?}[]` | Last item is `aria-current="page"`; separator flips in RTL |
| `Pagination` | native | `page`, `pageCount`, `hrefFor(page)` | Renders real links (crawlable). Admin tables use it with `onPageChange` instead |
| `LoadMore` | `Button` | `hasMore`, `loading`, `onLoadMore`, `shown`, `total` | Storefront listings: "Showing 24 of 310" + button. No infinite scroll (DOC-06) |

### 4.5 Display and feedback

| Component | Props | Notes |
|---|---|---|
| `Badge` | `tone`, `variant: 'soft' \| 'solid' \| 'outline'`, `children` | `soft` = `bg-<tone>-soft text-fg` |
| `StatusBadge` | `status: OrderStatus \| PaymentStatus \| ProductStatus \| StockStatus` | The only place a status maps to a tone and a label key; table in §6 |
| `Price` | `money: Money`, `compareAt?: Money`, `size` | Uses `formatMoney` from `@noor/i18n`; wraps in `<bdi dir="ltr">`; `compareAt` renders struck through with a visually hidden "was" label; sale price uses `text-sale` |
| `Ltr` | `children` | `<bdi dir="ltr">` for order numbers, SKUs, phones |
| `Image` | `src`, `alt` (**required**; `""` only for decorative), `width`, `height`, `sizes`, `priority?`, `ratio?` | Builds `srcSet` for the image transform URL scheme (ADR-0011); always sized, so no layout shift; `loading="lazy"` unless `priority` |
| `Card` | `padding`, `as?` | `bg-surface border border-line rounded-card shadow-card` |
| `Skeleton` | `className` (sets size) | `aria-hidden`; the parent region carries `aria-busy` |
| `Spinner` | `size`, `label` | `role="status"` with a visually hidden label |
| `EmptyState` | `icon?`, `title`, `body?`, `action?` | |
| `ErrorState` | `title`, `body?`, `onRetry?`, `code?` | Shows a retry button when `onRetry` is given; `code` is shown small for support |
| `Table` | `children` (`thead`/`tbody` parts) | Styling only: sticky header, row hover, numeric cells `text-end tabular-nums`. The admin `DataTable` built on TanStack Table lives in `apps/admin/src/components` (DOC-07 tables) |
| `VisuallyHidden` | `children` | |
| `Carousel` | `items`, `renderItem`, `label`, `autoPlayMs?` | CSS scroll-snap; prev/next buttons flip in RTL; auto-play pauses on hover, focus and reduced motion, and has a visible pause button when enabled |
| `DirectionProvider` | `direction: 'ltr' \| 'rtl'` | Re-export of Base UI's; set once at the app root |

## 5. Keyboard maps

| Component | Key | Action |
|---|---|---|
| `Dialog`, `Drawer`, `ConfirmDialog` | `Tab` / `Shift+Tab` | Cycle focus inside |
| | `Esc` | Close (not `ConfirmDialog` while pending) |
| `Menu` | `Enter` / `Space` / `ArrowDown` on trigger | Open, focus first item |
| | `ArrowDown` / `ArrowUp` | Move |
| | `Home` / `End` | First / last item |
| | type a letter | Jump to the next item starting with it |
| | `Esc` | Close, focus trigger |
| `Select`, `Combobox` | `ArrowDown` / `ArrowUp` | Move highlight (opens if closed) |
| | `Enter` | Choose |
| | `Esc` | Close without change |
| | typing (`Combobox`) | Filter |
| `Tabs` | `ArrowRight` / `ArrowLeft` | Next / previous tab; **swapped under RTL** |
| | `Home` / `End` | First / last tab |
| `RadioGroup`, `OptionChips` | Arrow keys | Move and select; inline arrows swapped under RTL |
| `Accordion` | `Enter` / `Space` | Toggle |
| | `ArrowDown` / `ArrowUp` | Next / previous header |
| `Checkbox`, `Switch` | `Space` | Toggle |
| `QuantityStepper`, `NumberInput` | `ArrowUp` / `ArrowDown` | ±1 step |
| | `PageUp` / `PageDown` | ±10 steps |
| `Carousel` | `ArrowRight` / `ArrowLeft` when focused | Next / previous slide; swapped under RTL |
| `Toast` | `F6` | Move focus to the toast region |
| | `Esc` | Dismiss the focused toast |
| `Tooltip` | `Esc` | Hide |

## 6. Status mapping (`StatusBadge`)

| Status (contract enum value) | Tone | Label key |
|---|---|---|
| Order: `pending` | neutral | `status.order.pending` |
| Order: `pending_confirmation` | warning | `status.order.pending_confirmation` |
| Order: `confirmed` | accent | `status.order.confirmed` |
| Order: `dispatched` | accent | `status.order.dispatched` |
| Order: `delivered` | success | `status.order.delivered` |
| Order: `cancelled` | danger | `status.order.cancelled` |
| Order: `returned` | danger | `status.order.returned` |
| Payment (order level): `unpaid` | neutral | `status.payment.unpaid` |
| Payment: `deposit_paid` | accent | `status.payment.deposit_paid` |
| Payment: `paid` | success | `status.payment.paid` |
| Payment: `refund_due` | warning | `status.payment.refund_due` |
| Payment: `partially_refunded`, `refunded` | neutral | `status.payment.<value>` |
| Product: `draft` | neutral | `status.product.draft` |
| Product: `scheduled` | warning | `status.product.scheduled` |
| Product: `active` | success | `status.product.active` |
| Product: `archived` | neutral | `status.product.archived` |
| Stock: `in_stock` | success | `status.stock.in_stock` |
| Stock: `low_stock` | warning | `status.stock.low_stock` |
| Stock: `sold_out` | danger | `status.stock.sold_out` |
| Stock: `made_to_order` | accent | `status.stock.made_to_order` |
| Stock: `preorder` | accent | `status.stock.preorder` |

A status is never shown by colour alone: the badge always has its text label. The enum sets are those of DOC-09.0 §5 (reconciled in Phase 7). `StatusBadge` shows the **order-level** payment status; the per-payment state appears only as text in the admin payments list.

## 7. Example

```tsx
// packages/ui/src/components/button.tsx
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../cn'
import { Spinner } from './spinner'

const variants = {
  primary: 'bg-accent text-on-accent hover:brightness-95 active:brightness-90',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-surface hover:brightness-95',
  link: 'text-accent-text underline underline-offset-4 h-auto px-0',
} as const
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-base', lg: 'h-13 px-6 text-md' } as const

type Props = ComponentProps<'button'> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  fullWidth?: boolean
}

export function Button({ variant = 'primary', size, loading, iconStart, iconEnd, fullWidth, className, children, disabled, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-(--dur-micro)',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant], size ? sizes[size] : 'h-(--control-h) px-4',
        fullWidth && 'w-full', className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : iconStart}
      {children}
      {iconEnd}
    </button>
  )
}
```

`danger` on `bg-danger` uses `text-surface`; its ratio (5.9:1 light, 5.98:1 dark for the admin brand) is covered by the contrast script because `danger` on `surface` is the same pair.

## 8. RTL spike (ADR-0007, mandatory before building §4.3)

Task `M0-11`, run on 2 Oct 2026 with `@base-ui/react` 1.8.0 (`packages/ui/src/spikes/rtl-spike.stories.tsx`, story `Spikes/RTL`; deleted at M2-05 after the real components landed, see git history of commit 90425f5): one Storybook page in `dir="rtl"` containing `Dialog`, a side drawer (a `Dialog` docked with `end-0`), `Menu` with a submenu, `Tabs`, `Combobox`, `Select`, `Tooltip`, `Popover`, inside `<DirectionProvider direction="rtl">`. Measured in the browser pane with real key presses (the pane at 1000 px wide).

| Check | Pass condition | Result |
|---|---|---|
| Drawer | Slides from the left edge | **Pass**: docked at the left edge. Slide-in uses `ltr:`/`rtl:` variants on `translate-x` |
| Menu submenu | Opens toward the left; `ArrowLeft` opens it, `ArrowRight` closes it | **Pass**: submenu at x 516–628 left of the parent menu (627–726); `ArrowLeft` opened it with focus on its first item; `ArrowRight` closed it and returned focus to the trigger item; `ArrowRight` on the trigger did not open it. The chevron needs `rtl:-scale-x-100` |
| Tabs | `ArrowLeft` moves to the next tab (visually leftward) | **Pass**: tabs are laid out right to left, Tab A at the right; `ArrowLeft` moved A → B, `ArrowRight` went back |
| Combobox / Select popup | Aligned to the right edge of the trigger; text right-aligned | **Pass for Combobox** (popup right edge = input right edge). **Select fails with its default**: item-aligned positioning put the popup 14 px past the trigger's start edge, not mirrored from LTR. **Fix: `alignItemWithTrigger={false}` on `Select.Positioner`** gives a normal anchored popup, right-aligned (inset 4 px by the popup padding). Make this the default in the `Select` component |
| Tooltip / Popover with `side="inline-end"` | Appears on the left | **Pass**: Popover opened left of its trigger. The Tooltip had no room on the left, so it flipped to `inline-start` (the right) as designed; `data-side` reports the logical side |
| Focus return | Trigger refocused on close | **Pass** for Drawer, Menu, Popover, Select. Dialog is centred correctly (`start-1/2` with `ltr:`/`rtl:` translate) |

Not verifiable in the browser pane and identical in LTR (so not a direction issue): focus moving into a Dialog when it opens, and Tab trapping, were not observed because the pane often reports `document.hasFocus() === false`. M2-07 covers focus trapping with Playwright component tests.

Result: **Base UI passes; no Radix fallback needed** (ADR-0007). `DirectionProvider` only changes component behaviour; the Storybook decorator and the apps set `dir` on `<html>` themselves.

## 9. Rules

**Always:** add or change the props table here in the same PR as the code; give every `IconButton` a `label` and every `Image` an `alt`; put a control inside a `Field`.
**Never:** import `@base-ui/react`, `@radix-ui/*` or `lucide-react` icons by deep path in an app (icons are imported from `lucide-react` by name; primitives only from `@noor/ui`); add a boolean prop that selects a visual style (use `variant`); fetch data or read a router inside `@noor/ui`; build a second modal, toast or select in an app.
**Common mistakes:** copying a Radix-flavoured `asChild` snippet; a `div` with `onClick` instead of `Button`; a custom dropdown where `NativeSelect` is better on mobile; passing float rupees to `Price` (it takes `Money`).

## 10. Acceptance checklist

- [ ] Every component in §4 exists with stories for each variant and state, an `RTL` story and a `Dark` story.
- [x] `pnpm --filter @noor/ui test` runs the a11y check on every story with zero violations (M2-05, 35 stories).
- [x] Each row of §5 has an interaction test, except `F6` and `Esc` on a focused toast (Base UI behaviour, not yet asserted).
- [ ] `grep -rn "@radix-ui\|@base-ui" apps` returns nothing.
- [ ] `grep -rn "asChild" apps packages` returns nothing.
- [x] `M0-11` RTL spike table in §8 is filled in (M0-11, 2 Oct 2026).

## 11. Open questions and assumptions

**M2-01 notes.** Built: Button, IconButton, LinkButton, Spinner (needed by Button), Field, Input, Textarea, NativeSelect, Checkbox, RadioGroup (`default` and `card`), Switch, NumberInput, MoneyInput, PhoneInput, QuantityStepper, OptionChips; plus `safeHref` (`@noor/ui/safe-href`, 23 tests). Built-in labels use `useTranslation()` from `react-i18next`, so an app (and Storybook) must provide an `I18nextProvider`; keys `loading`, `increase`, `decrease`, `maxQuantity`, `quantity` are in `@noor/i18n` `common`. New token `--control-text` (admin 14 px, storefront 16 px so iOS does not zoom into inputs) sits beside `--control-h`. `IconButton` shows its label as a `title` until Tooltip exists (M2-02). Axe (the engine behind `addon-a11y`) was run over all 14 stories in a browser: zero violations; the CI pipeline for it is M2-05. Interaction tests for the keyboard maps are not written yet (M2-05); behaviour was checked by hand in the browser (MoneyInput, PhoneInput, sold-out chips, stepper limit).


| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-04b-1 | Base UI primitive names (`NumberField`, `ToggleGroup`, `Combobox`, `Toast`, `Field`) | Exist in `@base-ui/react` 1.8 as named; not checked against base-ui.com component by component | First build of each component; a missing primitive is hand-built on native elements and noted here |
| Q-04b-2 | RTL spike | **Answered at M0-11**: passes; Select needs `alignItemWithTrigger={false}` | §8 |
| Q-04b-3 | Storybook interaction tests through `@storybook/addon-vitest` | **Changed at M2-02**: the keyboard-map tests are Vitest + jsdom + Testing Library + user-event (`packages/ui/test/*.test.tsx`, helper `test/dom.tsx`), with no browser download and no Storybook coupling. Base UI focus management, menus, selects, comboboxes, toasts and tooltips all work in jsdom; layout and animation do not, so positions and slide direction were checked in a real browser (M0-11, M2-02). `addon-vitest` is not used. **M2-05 done**: `test/stories.a11y.test.jsx` renders every story with `composeStories` (project annotations from `.storybook/preview.tsx`, so providers and per-story `globals` apply) and runs axe over the whole document; it also proves the gate fails on an unlabeled button. Rules off: `color-contrast` (no layout in jsdom; the token gate covers the pairs) and `region` (page-level) | M2-05 finds jsdom cannot cover a required row |
| Q-04b-4 | `tailwind-merge` support for Tailwind v4 class names | **Answered at M0-10**: v3.7 supports Tailwind v4, **but it must be told our token names**: unconfigured it classifies `text-md` (a size) as a color and drops one of `text-md text-fg`. `cn()` uses `extendTailwindMerge` with our colors, text sizes, radii, shadows, fonts, leading and z-index values; `packages/ui/test/cn.test.ts` covers it. **Keep the lists in `cn.ts` in step with `tokens.css`** | Any new token name |

**M2-02 notes.** Built: Dialog, Drawer, ConfirmDialog, Popover, Menu, Tooltip, Toast (`ToastProvider` + `useToast`), Select, Combobox (single, `multiple`, async `onSearch` with a 250 ms debounce that ignores answers to older queries). Differences from the table in §4.3: `Dialog`/`Drawer`/`ConfirmDialog`/`Popover`/`Menu`/`Tooltip` take `trigger` (or `children` for Tooltip) as an element rendered through Base UI's `render`; `Popover` needs a `label` (the panel's accessible name); `Menu` has no submenu yet (build it with the first screen that needs one; the RTL behaviour is proven in §8); `Select` sets `alignItemWithTrigger={false}` (§8). Toasts beyond 3 are not rendered (Base UI marks them `limited`). The toast close button is `aria-hidden` until the viewport is expanded or focused (Base UI behaviour). New `common` keys: `cancel`, `confirm`, `typeToConfirm`, `dismiss`, `noResults`, `searching`, `notifications`, `remove`. Keyboard-map rows covered by tests: Dialog/Drawer/ConfirmDialog (open, Tab trap, Esc, focus return, non-dismissible, pending, typed confirm, backdrop), Menu (open keys, arrows, Home/End, typeahead, Enter, Esc), Select, Combobox (filter, arrows, Enter, Esc, async, multiple), Popover, Tooltip, Toast. Not covered yet: `F6` to the toast region, `Esc` on a focused toast, Menu under RTL (nothing direction-dependent in a flat menu). Axe: zero violations on the 10 overlay stories (open dialogs and drawers included).

**M2-03 notes.** Built: Tabs (+ `TabsPanel`), Accordion, Breadcrumb, Pagination (`hrefFor` links or `onPageChange`; `pageWindow()` exported), LoadMore, Badge, StatusBadge, Card, Skeleton, EmptyState, ErrorState, Table (+ `Th`, `Td` with `numeric`), Carousel, VisuallyHidden, Ltr, and `Link` (a `safeHref`-checked `<a>` that Breadcrumb and Pagination use; pass `renderLink` for the app router). `Spinner` came with M2-01 and `DirectionProvider` with M0-12. Details that differ from or add to §4: `StatusBadge` accepts any value of the four contract enums (all 22 values are unique across them) and its test checks that each has an English and an Urdu label; `Card` uses `render` (not `as`); `Table` wrapper is focusable (a keyboard user can scroll a wide table) and takes an optional `label`; `Pagination` takes an optional `label` because two on one page need different names. **Base UI 1.8 does not move focus between accordion headers**, so `Accordion` does it itself (ArrowDown, ArrowUp, Home, End, wrapping). Carousel reads the page direction from the nearest `dir` attribute, uses `scrollBy`, hides nothing from the accessibility tree, pauses on hover, focus, reduced motion and by a visible button. Fixes found by axe while building: slide markup must be `div`s (not `li role=group`), `warning` solid text is `text-surface` (the warning color is dark in light mode and light in dark mode), two navs need different names, a scroll region must be focusable. Axe: zero violations on the 3 stories (default, RTL, Dark). Tests: 19 in `test/navigation.test.tsx` (Tabs arrows swapped in RTL, Accordion keys, Carousel arrows swapped in RTL, Breadcrumb, Link, Pagination, LoadMore, StatusBadge coverage).

**M2-04 notes.** Built: Image (+ `imageProps(apiImage)`), Price, Markdown (+ `replaceTokens`), RHFField (in `field.jsx`, as DOC-05 says) and ImageUpload. `Image` takes the API `Image` object through `imageProps`, so no component builds a transform URL; it is lazy and always sized, `priority` makes it eager with `fetchpriority="high"`, and `lqip` becomes the background while it loads. `Price` reads the page language from i18next, takes the store `priceDisplay` as `display`, wraps in `bdi dir="ltr"` and shows a struck-through "was" price only when `compareAt` is higher. `Markdown` follows DOC-06.8 §2: allow-list, `#` becomes `h2`, links through `safeHref`, images only from `imageOrigin` with a `"WxH"` title, `skipHtml`, tokens from settings; it adds `remark-gfm` (tables). `RHFField` translates `errors:<code>`; an unknown code shows `errors.unknown`, never the raw code. `ImageUpload` is generic over `{ id, src, alt? }` (the contract has no `MediaRef`; the admin media record passes through unchanged), uploads several files at once, keeps the list correct when they finish in any order, never sends more than `maxFiles` and shows a per-file spinner and error. New keys: 18 field-error codes in `errors`, and `upload`, `dropHere`, `uploading`, `uploadFailed`, `removeImage` in `common`. 20 tests in `test/data.test.tsx` (including the DOC-06.8 §6 script/link/image case); axe clean on 3 stories.

## 12. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 1) |
| 2026-10-02 | Phase 7 consistency review: payment and stock statuses match DOC-09.0 §5 |
| 2026-10-02 | M0-10: `cn()` configured with the token names (Q-04b-4) |
| 2026-10-02 | M0-11: RTL spike run, results in §8; Q-04b-2 answered |
| 2026-10-02 | M2-01: props table aligned with the built components (IconButton `icon`, MoneyInput uses `parseRupees`, QuantityStepper `label`, NumberInput `aria-label`); notes in §11 |
| 2026-10-02 | M2-02: overlay components built; Q-04b-3 changed to jsdom keyboard tests; notes in §11 |
| 2026-10-02 | M2-03: navigation, display and feedback components built; notes in §11 |
| 2026-10-02 | M2-04: data-aware components built; notes in §11 |
| 2026-10-02 | M2-05: story a11y gate built (jsdom + axe over every story); acceptance checklist ticked; spike stories removed |

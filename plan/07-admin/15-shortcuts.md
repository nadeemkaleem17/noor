# 07.15 — Admin: Keyboard Shortcuts and Command Palette

| Field | Value |
|---|---|
| ID | DOC-07.15 |
| Title | Global shortcuts, list and form shortcuts, command palette |
| Status | Draft |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-07.1, DOC-07.14, DOC-04b §5 |
| Decisions used | ADR-0007, ADR-0015 |

## 1. Purpose and scope

**Governs:** every keyboard shortcut in the admin beyond the component-level keys in DOC-04b §5, and the command palette.
**Does not govern:** the storefront (no custom shortcuts there).

Staff who process orders all day work fastest from the keyboard; everything here is also reachable by mouse or touch.

## 2. Global shortcuts

`Mod` = `Ctrl` on Windows/Linux, `⌘` on macOS (detected from `navigator.platform`; the help sheet shows the right symbol).

| Keys | Action |
|---|---|
| `Mod` `K` | Open the command palette |
| `/` | Focus the current screen's search box |
| `?` | Open the shortcut help sheet |
| `g` then `d` | Go to Dashboard |
| `g` then `o` | Go to Orders |
| `g` then `p` | Go to Products |
| `g` then `c` | Go to Customers |
| `g` then `r` | Go to Reviews |
| `g` then `s` | Go to Store settings |
| `c` | Create: the current list's primary "New …" action (new product on Products, new promo on Promos) |
| `Mod` `S` | Save the current form (prevents the browser's save dialog) |
| `Esc` | Close the top-most overlay; in a form with no overlay, blur the field |
| `[` | Collapse / expand the sidebar |

A `g` sequence waits 1 s for the second key.

## 3. List shortcuts (any `DataTable`)

| Keys | Action |
|---|---|
| `j` / `↓` | Move row focus down |
| `k` / `↑` | Move row focus up |
| `Enter` or `o` | Open the focused row |
| `x` or `Space` | Toggle selection of the focused row |
| `Shift` `x` | Select from the last selected row to the focused row |
| `Mod` `A` | Select all rows on the page (press again: select all matching) |
| `Esc` | Clear the selection |
| `n` / `p` | Next / previous page |
| `r` | Refresh the list |
| `.` | Open the focused row's ⋯ menu |

The focused row has a visible focus ring and `aria-selected` reflects selection, not focus.

## 4. Order detail shortcuts

Each triggers the same dialog as its button and is active only when that action is in `allowedActions` and permitted for the user.

| Keys | Action |
|---|---|
| `a` | Log a confirmation attempt |
| `Shift` `C` | Confirm order |
| `Shift` `D` | Mark dispatched |
| `Shift` `L` | Mark delivered |
| `w` | Open WhatsApp to the customer |
| `i` | Print invoice |
| `m` | Focus the internal-note field |
| `]` / `Shift` `]` | Next / previous order in the list the user came from (the list's ids are passed in router state) |

State-changing actions use `Shift` so a stray key press cannot fire them, and they only open a dialog: nothing is committed without the dialog's confirm button.

## 5. Rules for all shortcuts

| Rule | Detail |
|---|---|
| Typing safety | Single-key shortcuts are ignored while focus is in an `input`, `textarea`, `select`, `[contenteditable]` or any open `Combobox`/`Menu`, and while a modifier other than the listed one is held. `Mod` shortcuts work everywhere |
| Overlays | While a `Dialog`/`Drawer` is open, only its own keys, `Esc`, and `Mod` `S` (if it contains a form) are active |
| One implementation | A single `useShortcut(keys, handler, { when })` hook in `apps/admin/src/lib/shortcuts.ts` registers on `document` and is the only place key events are handled for shortcuts; it also feeds the help sheet, so the sheet cannot be out of date |
| Discoverability | Buttons with a shortcut show it in their tooltip (`Tooltip`: "Confirm order · Shift C"); the `?` sheet lists shortcuts grouped by Global / Lists / This screen |
| Conflicts | No shortcut overrides a browser or screen-reader default other than `Mod` `K` and `Mod` `S`. WCAG 2.1.4: because single-character shortcuts exist, **My account → Preferences** has "Enable single-key shortcuts" (default on); turning it off leaves only `Mod` shortcuts |
| Layout independence | Letters match `event.key` (the character typed), not physical key codes, so they work on non-QWERTY layouts |

```ts
// apps/admin/src/lib/shortcuts.ts (shape)
useShortcut('shift+d', () => openDialog('dispatch'), {
  when: can('orders:dispatch') && order.allowedActions.includes('dispatch'),
  label: 'Mark dispatched', group: 'This screen',
})
```

## 6. Command palette (`Mod` `K`)

A `Dialog` with a `Combobox`.

| Section | Content |
|---|---|
| Go to | Every sidebar destination the user can access |
| Actions | "New product", "New promo code", "Invite staff", "Toggle theme", "Sign out", and the current screen's actions (those registered through `useShortcut`) |
| Search results (typed text ≥ 2 characters, debounced 250 ms) | One request to `admin.search?q=`, returning up to 5 each of: orders (by number, phone digits, customer name, tracking number), products (title, SKU, handle), customers (name, phone). Each result shows a type icon, primary text and a secondary line (order: status and total; product: status and stock; customer: city and order count) |

| Rule | Detail |
|---|---|
| Shortcuts in the palette | Typing an order number (`10458` or `RB-10458`) puts that order first |
| Keyboard | `↑`/`↓` move, `Enter` opens, `Mod` `Enter` opens in a new tab, `Esc` closes |
| Permissions | Results and actions are filtered by the API and by `useCan`; a `catalog` role gets no order or customer results |
| Empty and error | "No matches"; on failure the Go to and Actions sections still work |
| Recent | With an empty input: the user's 5 most recently opened entities (kept in `sessionStorage`) |

## 7. Rules

**Always:** register shortcuts through `useShortcut`; show the shortcut in the control's tooltip; keep state-changing shortcuts behind a dialog.
**Never:** bind a key that fires a mutation directly; add `keydown` listeners in feature components; capture keys while the user is typing; rely on a shortcut as the only way to do something.
**Common mistakes:** a shortcut active behind an open dialog; using `event.code`; forgetting the WCAG off-switch.

## 8. Acceptance checklist

- [ ] Typing `j`, `x`, `c` inside a text field types the letters and triggers nothing.
- [ ] Every shortcut in §2–§4 appears in the `?` sheet, generated from registrations.
- [ ] `Shift D` on an order that cannot be dispatched does nothing; on one that can, it opens the dispatch dialog and commits nothing until confirmed.
- [ ] With "Enable single-key shortcuts" off, only `Mod` shortcuts respond.
- [ ] The palette finds an order by number, phone digits and tracking number, and a product by SKU.
- [ ] A `catalog` user's palette returns no orders or customers.
- [ ] `grep -rn "addEventListener('keydown'" apps/admin/src` matches only `lib/shortcuts.ts`.

## 9. Open questions and assumptions

| # | Item | Assumption | Revisit trigger |
|---|---|---|---|
| Q-07.15-1 | `admin.search` endpoint | One combined search route | DOC-10 |
| Q-07.15-2 | Customisable shortcuts | Not in v1 | Staff request |
| Q-07.15-3 | Barcode scanner input on the orders list (scan an invoice barcode to open the order) | A scanner types the order number + Enter; focusing the search box (`/`) makes this work with no extra code | Warehouse adopts scanners |

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-02 | Initial version (Phase 3) |

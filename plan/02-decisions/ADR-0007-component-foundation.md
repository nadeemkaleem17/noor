# ADR-0007 — Owned shadcn-style components on Base UI

| Field | Value |
|---|---|
| ID | ADR-0007 |
| Title | Component foundation (Radix vs shadcn-style, which primitives) |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K1), ADR-0006 |
| Decisions used | ADR-0018 |

## Purpose and scope
Which headless primitive library and distribution model back `packages/ui`. Component APIs are DOC-04 `components.md`.

## Context
The admin uses seven `@radix-ui/*` packages (`admin package.json`: collapsible, dialog, dropdown-menu, switch, tabs, toast, tooltip). Since 3 Jul 2026 `shadcn init` defaults to Base UI; Radix is not deprecated and remains selectable. Base UI reached 1.0 in Dec 2025 and 1.8.0 on 4 Sep 2026 (DOC-02 §4; secondary sources). One GitHub PR author says Radix "is no longer being developed"; this is uncorroborated and is not used as evidence.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. shadcn-style on Radix | Largest example base; admin already uses Radix | Maintenance-pace concern; ecosystem defaults moving away |
| B. shadcn-style on Base UI | Current default; actively released; same authors' lineage | Younger; API differs (`render` prop vs `asChild`); fewer snippets |
| C. React Aria Components | Strong accessibility and i18n story | Different styling model; more rewrite |
| D. Keep current hand-rolled + Radix | No work | Two primitive stacks (hand-rolled `ui.jsx`, Radix); no system |

## Decision
**Option B.** `packages/ui` holds **owned** components (copied via the shadcn CLI with a `base-*` style, then edited), built on `@base-ui/react`, styled with Tailwind tokens (ADR-0006).
- No new `@radix-ui/*` dependencies. Existing admin Radix usage is replaced when that component is rebuilt in `packages/ui`; a component never mixes both libraries.
- Composition uses Base UI's `render` prop, not Radix's `asChild`.
- **Mandatory spike (first task of Phase 1/M0):** verify in an RTL Urdu page that Dialog, Menu, Tabs, Combobox/Select and Tooltip mirror correctly and keep keyboard behaviour. If any fails without a small patch, fall back to Option A for that component only and record it here.

## Examples
```
packages/ui/src/components/button.tsx
packages/ui/src/components/dialog.tsx      // wraps @base-ui/react Dialog
packages/ui/components.json                // shadcn config: style "base-nova"
```

## Consequences
We own the code of every primitive wrapper (more maintenance, full control); upgrades are deliberate. The admin is migrated gradually.

## Rules
**Always:** keep the public props of each component stable and documented in DOC-04; include keyboard and RTL tests. **Never:** import a primitive library directly in an app; style with hard-coded values. **Common mistake:** copying a Radix-flavoured snippet from an older tutorial into a Base UI project.

## Acceptance checklist
- [x] `grep -r "@radix-ui" apps/*/package.json packages/*/package.json` is empty after the admin migration milestone. (Run at M7-07: no match.)
- [ ] Each component has Storybook stories for all states and an axe test. **Open: every story is axe-checked; not every component has a story for every state.**
- [x] RTL spike result is recorded in DOC-04b §8 (M0-11).

## Revisit trigger
Spike fails on two or more components; Base UI ships a breaking major that costs more than 3 dev-days; or shadcn changes its default again.

## Open questions and assumptions
Base UI RTL behaviour is **verified at M0-11** (DOC-04b §8): all checks pass; the only change is `alignItemWithTrigger={false}` on the `Select` positioner. Base UI tooltip delay default (50 ms vs Radix 200 ms) will be set explicitly in DOC-04.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Phase 1: Base UI `DirectionProvider` confirmed to exist; RTL spike specified in DOC-04b §8, still to run |
| 2026-10-02 | M0-11: RTL spike passed on Base UI 1.8.0; no Radix fallback needed |

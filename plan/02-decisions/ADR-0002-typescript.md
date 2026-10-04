# ADR-0002 — Strict TypeScript for all new code; admin migrated incrementally

| Field | Value |
|---|---|
| ID | ADR-0002 |
| Title | TypeScript migration |
| Status | **Superseded by ADR-0021** (4 Oct 2026: the owner chose JavaScript) |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K3, F-15, F-23), ADR-0003 |
| Decisions used | ADR-0005 |

## Purpose and scope
Governs language and compiler settings for `apps/*` and `packages/*`. Does not govern lint style (DOC-15).

## Context
All three codebases are untyped JavaScript (`.jsx`, `.js`; no `tsconfig`/`jsconfig`, F-23). The contract is the integration point, and its drift (K2) is a typing problem. v2 already chose TypeScript; this ADR fixes *how*. Zod is tested against TypeScript ≥ 5.5 (zod.dev).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Stay JS + JSDoc | No migration | Contract types unenforced; agents guess shapes |
| B. Big-bang TS rewrite of admin | Clean | Weeks of zero feature progress |
| C. Strict TS for everything new; migrate admin file by file | Value early; low risk | Mixed codebase for a while |

## Decision
**Option C.**
- New: `apps/storefront`, `apps/api`, `packages/*` are TypeScript only.
- Admin: becomes `apps/admin`; `allowJs: true`, `checkJs: false` during migration. Any file edited by more than 10 lines is renamed to `.ts/.tsx` in the same PR. A CI counter (`scripts/ts-ratio.mjs`) fails if the TS share of admin `src/` goes down.
- Compiler: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `moduleResolution: "bundler"` (apps) / `"NodeNext"` (api). TypeScript ≥ 5.5, pinned in the root `package.json`.
- Types derive from Zod: `type Product = z.infer<typeof Product>`; hand-written duplicates of contract types are forbidden.

## Examples
`packages/config/tsconfig.base.json`:
```json
{ "compilerOptions": { "target": "ES2023", "strict": true, "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true, "verbatimModuleSyntax": true, "skipLibCheck": true, "isolatedModules": true } }
```

## Consequences
Typed contract end to end; first weeks of admin work include rename noise in diffs; agents get compile errors instead of silent shape drift.

## Rules
**Always:** `unknown` plus a Zod parse at every boundary (network, storage, URL). **Never:** `any`, `// @ts-ignore` (use `@ts-expect-error` with a reason), non-null `!` outside tests. **Common mistake:** casting API JSON to a type instead of parsing it.

## Acceptance checklist
- [ ] `pnpm typecheck` passes in CI for every package.
- [ ] ESLint `@typescript-eslint/no-explicit-any` is `error`.
- [ ] Admin TS ratio never decreases.

## Revisit trigger
Admin TS share below 50% six weeks after M1 starts, or TypeScript's native compiler becoming the default toolchain (re-evaluate settings).

## Open questions and assumptions
Assumes TypeScript ≥ 5.5 is available. Native-compiler status not researched.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | M0-02: TypeScript pinned to ~6.0.3 because `typescript-eslint` 8.x supports `<6.1`; TypeScript 7.0 (native compiler) is the revisit trigger noted below, now actionable |
| 2026-10-04 | Superseded by ADR-0021: the language is JavaScript with JSDoc types; this document is kept for history |

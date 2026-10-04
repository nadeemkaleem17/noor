# ADR-0021 — JavaScript with JSDoc types (supersedes ADR-0002)

| Field | Value |
|---|---|
| ID | ADR-0021 |
| Title | Language: JavaScript, types in JSDoc |
| Status | Accepted (owner decision, 4 Oct 2026) |
| Owner | Owner / tech lead |
| Last updated | 2026-10-04 |
| Depends on | ADR-0005 |
| Supersedes | ADR-0002 (strict TypeScript) |

## Purpose and scope
The language of every workspace (`apps/*`, `packages/*`, `scripts/`). Does not change any other decision: Fastify, React Router, Zod contract, Tailwind and the rest are the same.

## Context
ADR-0002 chose strict TypeScript. On 4 Oct 2026 the owner decided: "keep it JavaScript, not TypeScript". By then M0-02 to M0-13 and M2 were built in TypeScript (about 113 files), so the change was applied by converting them.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Plain JavaScript, no types | Simplest | Contract shapes are not checked at build time; agents guess |
| B. JavaScript + JSDoc types, checked by `tsc --checkJs` | No TypeScript syntax in any source file; the contract types still flow to every caller; no build step for packages or the API (Node runs the files) | JSDoc is wordier; some advanced types (conditional, mapped) must live inside `@typedef` |
| C. Stay TypeScript | Most ergonomic | Rejected by the owner |

## Decision
**Option B.**
- Source files are `.js` (and `.jsx` for React). No `.ts` or `.tsx` source file, no TypeScript syntax (`: T`, `<T>`, `as`, `interface`, `enum`, `readonly`).
- Types are JSDoc: `@param`, `@returns`, `@type`, `@template`, `@typedef`. The shape of data still comes from Zod: `/** @typedef {z.infer<typeof Money>} Money */`. A hand-written duplicate of a contract type is still forbidden.
- `typescript` stays as a **dev tool only**: `pnpm typecheck` runs `tsc -p tsconfig.json` with `allowJs`, `checkJs`, `strict`, `noEmit` from `packages/config/tsconfig.base.json`. It emits nothing.
- Packages are consumed as JavaScript source. Node-run code (`packages/contract`, `packages/i18n`, `apps/api`, `scripts`) writes relative imports **with the `.js` extension** (`'./money.js'`) because Node ESM requires it. Vite-bundled code (`packages/ui`, `apps/storefront`) may omit it.
- The API runs as `node src/main.js`; there is no `tsx` and no build step. `.d.ts` files and `declare module` augmentation are not used; where Fastify's types need an extra field, cast with JSDoc.
- ESLint keeps `typescript-eslint` for its rules and parser, and the bans that still apply in JS: `ts-ignore` is forbidden, `ts-expect-error` needs a description (tsc still reads them in `.js`).
- Admin: the old code stays JavaScript and is rewritten screen by screen from M3. The TypeScript-share counter (`scripts/ts-ratio.mjs`) is deleted.

How to read the rest of the plan: wherever a document names a `.ts` file (`platform/config.ts`, `money.ts`, `routes.ts`) the real file is the same name with `.js`; `.tsx` is `.jsx`. Code samples in TypeScript show the intended shape; write them as JavaScript with JSDoc.

## Conversion notes (what changed in code)
- A TypeScript `interface` or `type` became a `@typedef`; imports of types became `import('module').Name` inside the JSDoc.
- `useState<T>(x)` and `useRef<T>(x)` became `useState(/** @type {T} */ (x))`.
- Constructor parameter properties (`constructor(readonly code)`) became explicit `this.code = code`.
- `as const` and `as T` became `/** @type {const} */ (…)` and `/** @type {T} */ (…)`; `satisfies T` became `/** @satisfies {T} */ (…)`.
- A multi-line JSDoc comment placed right after `return` ends the statement (automatic semicolon insertion); the converter wraps such a function in parentheses.
- Tuple rest parameters are `@param {Args<…>} args` without `...` (with `...` JSDoc means an array of that element type).
- Generic type parameters use `@template {Constraint} const T`; the `extends` form is not read by `tsc` in JSDoc.

## Consequences
Less type ergonomics, no compile step, one language. The contract's compile-time tests (`@ts-expect-error` lines) still run under `tsc --checkJs`.

## Rules
**Always:** annotate exported functions with JSDoc; keep `pnpm typecheck` green; give `@ts-expect-error` a reason. **Never:** add a `.ts` file or TypeScript syntax; use `any` casually (`{*}` or `{unknown}` with a check). **Common mistake:** `@param {...Tuple} rest` for a typed rest parameter.

## Revisit trigger
The owner changes the decision, or JSDoc-only typing blocks a feature (a type that cannot be written in JSDoc).

## Changelog
| Date | Change |
|---|---|
| 2026-10-04 | Accepted. All existing TypeScript converted to JavaScript with JSDoc in one change |

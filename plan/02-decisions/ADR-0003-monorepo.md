# ADR-0003 — pnpm workspaces + Turborepo

| Field | Value |
|---|---|
| ID | ADR-0003 |
| Title | Monorepo tool |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (K2, K3), ADR-0002 |
| Decisions used | ADR-0005, ADR-0007 |

## Purpose and scope
Repository layout, workspace tool and task runner. Does not govern branching (DOC-15) or CI jobs (DOC-14).

## Context
Three separate projects copy the contract and utilities by hand (K2, K3; `mock-api/schemas.js:1-2`). The brief requires one Zod contract package and a shared UI package. A root repo already exists informally (`mock-api/README.md` refers to one) but was not supplied.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Polyrepo + published packages | Isolation | Version dance for a 3-person team; the exact drift we have now |
| B. pnpm workspaces only | Simple | No task graph/caching; manual ordering |
| C. pnpm workspaces + Turborepo | Task graph, caching, small config | One more tool |
| D. Nx | Rich generators, boundaries | Heavier; more concepts for agents to learn |

## Decision
**Option C.** Package manager pinned with the `packageManager` field; Node pinned to **22.22** in `.nvmrc` (React Router v8 floor, ADR-0004).

```
noor/
  apps/ storefront/  admin/  api/
  packages/ contract/  ui/  config/  i18n/
  plan/            (this documentation set; the brief called it docs/)
  turbo.json  pnpm-workspace.yaml  package.json  .nvmrc
```
- `packages/contract`: Zod schemas, route table, `Money` helpers. No React, no Node APIs.
- `packages/ui`: tokens + components (ADR-0006/0007). Depends on React only.
- `packages/config`: `tsconfig.base.json`, ESLint flat config, Tailwind preset.
- `packages/i18n`: message catalogs and formatters (ADR-0018).
- Import direction: `apps/*` → `packages/*`; packages never import apps; `contract` imports nothing internal.

## Examples
`turbo.json` tasks: `build` (dependsOn `^build`), `typecheck`, `lint`, `test`, `dev` (persistent, not cached).

## Consequences
One place for the contract; atomic cross-app changes; CI can run only affected tasks.

## Rules
**Always:** declare workspace deps as `workspace:*`. **Never:** deep-import another package's `src/` path; copy code between packages. **Common mistake:** putting a helper in an app because "only one app uses it today"; if two apps do, move it in the same PR.

## Acceptance checklist
- [ ] `pnpm install && pnpm turbo run build typecheck lint test` passes on a clean clone. **Open: not tried on a clean clone.**
- [x] No duplicated `Money`, `ApiError`, `usePersistentState` implementations remain (K3). (The old copies were deleted (M6-07, M7-04); one `Money` and one `ApiError` live in `@noor/contract`.)

## Revisit trigger
More than 8 workspaces, or CI over 10 minutes with Turborepo caching on, or a need for enforced module boundaries beyond ESLint (consider Nx).

## Open questions and assumptions
Turborepo and pnpm were **not researched in Phase 0** (author judgement); verify current majors during M0 repo setup. Assumes the team accepts a single repo.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Phase 1: versions verified and pinned in DOC-03 §2 (pnpm 11, not 12; turbo 2.11). `docs/` folder is named `plan/` in this repo |
| 2026-10-02 | Phase 7 consistency review: folder name `plan/` in the tree |

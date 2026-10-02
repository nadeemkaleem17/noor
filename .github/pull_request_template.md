## What and why
<!-- 2–4 sentences. Link the task: M1-014. -->

## Docs
- Implements: DOC-__ §__  (and ADR-____)
- Fixes findings: F-__ / K__   <!-- or "none" -->
- [ ] I updated the doc and its changelog if behaviour differs from it

## How to verify
<!-- Commands and clicks a reviewer can follow. -->

## Checklist
- [ ] `pnpm check` passes locally
- [ ] Contract changed first (route table / schema), then server, then client
- [ ] New UI has loading, empty and error states (DOC-04c §6)
- [ ] New or changed component has stories incl. RTL (DOC-04b §2)
- [ ] No money maths outside `@noor/contract` money helpers; no float rupees
- [ ] No new dependency, or it is justified below
- [ ] Migration is its own commit and is safe to re-run after a partial failure (ADR-0008)
- [ ] Screenshots at 360 px (storefront) / 1280 px (admin) for UI changes

## New dependencies
<!-- name, size, why not existing code or the platform -->

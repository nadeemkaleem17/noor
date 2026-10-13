# @noor/admin

The staff admin of the Rubaya shop: a React single-page app that talks to `apps/api`.

- How it is built, where things are and what the conventions are: [CLAUDE.md](CLAUDE.md).
- What each screen must do: `plan/07-admin/`.
- Run it with the API: `pnpm dev` at the repository root (needs MySQL, see the root CLAUDE.md).
- Tests, types and lint: `pnpm --filter @noor/admin test | typecheck | lint`.

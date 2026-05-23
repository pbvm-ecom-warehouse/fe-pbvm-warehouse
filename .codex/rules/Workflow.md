# Warehouse Workflow

1. Identify impacted module (inventory, transfer, purchase, report, etc.).
2. Preserve stock invariants and movement trail semantics.
3. Validate:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:e2e` for routing or workflow changes
4. Summarize operational risk in final notes.

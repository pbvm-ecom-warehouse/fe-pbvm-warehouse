# Warehouse Workflow

1. Identify impacted module (inventory, transfer, purchase, report, warehouse navigation, etc.).
2. Preserve stock invariants and movement trail semantics.
3. For put-away navigation, verify suggestion remains advisory and receiver confirms by barcode scan.
4. Check API contract against `be-wms-ecom` controllers/DTOs/Swagger before changing service types.
5. Validate:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:e2e` for routing or workflow changes
6. Summarize operational risk in final notes.

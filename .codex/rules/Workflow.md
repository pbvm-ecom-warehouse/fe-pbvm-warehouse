# Warehouse Workflow

1. Identify impacted module (inventory, transfer, purchase, report, warehouse navigation, etc.).
2. Preserve stock invariants and movement trail semantics.
3. For put-away navigation, verify suggestion remains advisory and receiver confirms by barcode scan.
4. Check API contract against `be-wms-ecom` controllers/DTOs/Swagger before changing service types.
5. For custom-print, goods issue, or order-driven warehouse work, verify event boundaries and docs first:
   - `docs/warehouse/workflow.md`
   - `docs/warehouse/use-cases.md`
   - `docs/overview/main-flow.md`
   - `docs/overview/data-ownership.md`
   - `docs/db/04-in-ly.md`
   Confirm `print.requested`, `print.completed`, `order.ready_to_fulfill`, `goods.issued`, and reserve semantics before editing UI or client types.
6. Validate:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:e2e` for routing or workflow changes
7. Summarize operational risk in final notes.

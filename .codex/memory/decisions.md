# Warehouse Decisions

- 2026-05-20: Admin protected flows use shared `axios` client with refresh-token handling.
- 2026-05-20: Stock calculations remain centralized in inventory utils and validated by unit tests.
- 2026-05-20: Compact notes for warehouse-only work must be written in this file.
- 2026-06-16: Warehouse navigation is 2D/advisory shelf guidance; no 3D warehouse bin-packing.
- 2026-06-16: Put-away suggestion remains backend-owned and receiver-confirmed by barcode with override.
- 2026-06-16: WMS frontend targets `/api/wms`, unwraps `{ data, meta }`, and refreshes through `/auth/refresh`.
- 2026-06-16: For warehouse UI work, apply the installed frontend skills (`frontend-design-ui-ux`, `generic-react-ux-designer`, `component-interface-design`, `react-shadcn`) as a polish pass for dense operational UX, clear visual hierarchy, smooth interactions, accessible states, responsive layout, and screenshot verification. Repo-local `.codex`, root `.codex`, `AGENTS.md`, and backend contracts stay higher priority.
- 2026-06-16: Warehouse dev server runs on `http://localhost:3101` via `pnpm dev`; do not use the Next default `3000` because ecommerce has its own frontend.
- 2026-06-17: For custom-print orders, WMS starts work from `print.requested` only after Ecommerce marks payment success; the order is in `fulfillment = AWAITING_PRINT` until all required print jobs complete.
- 2026-06-17: WMS consumes `designFile` as the production snapshot for cup printing and must not depend on reading mutable design-library state from Ecommerce DB.
- 2026-06-17: `order.ready_to_fulfill` is the boundary for Goods Issue creation; custom-print items reach it only after `print.completed` satisfies all print work for the order.
- 2026-06-17: WMS FE login follows the backend/docs contract `username + password`; do not fall back to an implicit admin session when no authenticated user exists.
- 2026-06-17: The canonical WMS UI surface for cup printing is `print-jobs`; keep `/cup-conversions` only as a compatibility redirect while copy, RBAC, and tests use `print-jobs`.
- 2026-06-17: Warehouse navigation renders `Zone -> Rack -> Shelf(level)` with shelf as the smallest barcode location; adding zone/rack/shelf is structure master-data work, not a put-away confirmation action.

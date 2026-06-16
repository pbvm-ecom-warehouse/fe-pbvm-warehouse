# Warehouse Decisions

- 2026-05-20: Admin protected flows use shared `axios` client with refresh-token handling.
- 2026-05-20: Stock calculations remain centralized in inventory utils and validated by unit tests.
- 2026-05-20: Compact notes for warehouse-only work must be written in this file.
- 2026-06-16: Warehouse navigation is 2D/advisory shelf guidance; no 3D warehouse bin-packing.
- 2026-06-16: Put-away suggestion remains backend-owned and receiver-confirmed by barcode with override.
- 2026-06-16: WMS frontend targets `/api/wms`, unwraps `{ data, meta }`, and refreshes through `/auth/refresh`.
- 2026-06-16: For warehouse UI work, apply the installed frontend skills (`frontend-design-ui-ux`, `generic-react-ux-designer`, `component-interface-design`, `react-shadcn`) as a polish pass for dense operational UX, clear visual hierarchy, smooth interactions, accessible states, responsive layout, and screenshot verification. Repo-local `.codex`, root `.codex`, `AGENTS.md`, and backend contracts stay higher priority.
- 2026-06-16: Warehouse dev server runs on `http://localhost:3101` via `pnpm dev`; do not use the Next default `3000` because ecommerce has its own frontend.

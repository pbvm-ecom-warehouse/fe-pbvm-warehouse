# Warehouse Codex Context

Repo: `fe-pbvm-warehouse`

This file defines repo-specific rules that override shared `@WDP/.codex` when needed.

## Scope

- Internal operations dashboard
- Inventory and stock movement views
- Purchase and transfer workflows
- Put-away suggestion and shelf navigation views
- Cup conversion and audit trails

## Priorities

1. Data correctness for warehouse operations
2. Clear auditability of stock-related actions
3. Stable and secure authenticated admin requests

## Shared Contract

- Root `@WDP/.codex` is the baseline.
- API source of truth: `be-wms-ecom` source and `/api/wms/docs`.
- Workflow source of truth for print/order boundaries: `docs/warehouse/workflow.md`, `docs/warehouse/use-cases.md`, `docs/overview/main-flow.md`, `docs/overview/data-ownership.md`, `docs/db/04-in-ly.md`.
- WMS API prefix: `/api/wms`.
- Success envelope: `{ data, meta }`; pagination is `meta.pagination`.
- Refresh endpoint: `/auth/refresh`.
- Put-away suggestion is backend-owned advisory logic; frontend renders shelf/path/capacity/reason and barcode confirmation.
- Do not build 3D warehouse bin packing. Ecommerce owns 3D cup design.
- WMS does not read Ecommerce DB directly; cross-app boundaries are events plus stable payload fields such as `sku`, `orderId`, `designId`, and `designFile`.

## Rule Set

- Workflow: `rules/Workflow.md`
- Code quality: `rules/Code-quality.md`
- Fetching strategy: `rules/Data-fetching.md`
- Folder boundaries: `rules/Folder-structure.md`
- Warehouse navigation: `@WDP/.codex/rules/Warehouse-navigation.md`

## Local Memory

- Decisions: `memory/decisions.md`

## Compaction Rule

- For changes only in this repo, compact into:
  - `fe-pbvm-warehouse/.codex/memory/decisions.md`
- For changes spanning both repos, compact into:
  - `@WDP/.codex/memory/decisions.md`

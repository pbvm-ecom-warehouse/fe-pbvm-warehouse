# WMS Shipping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live Warehouse Shipping workspace for carriers and shipments, with access aligned to the WMS backend.

**Architecture:** A typed `shipping` service owns all carrier and shipment requests and normalizes the shared list envelope. The `/shipping` route renders one client workspace with “Vận đơn” and “Hãng vận chuyển” tabs; React Query keeps list/detail data consistent after mutations.

**Tech Stack:** Next.js App Router, TypeScript, TanStack React Query, shadcn/ui, Vitest, Playwright.

## Global Constraints

- Use the authenticated shared Axios client and WMS `/api/wms` prefix.
- Keep all operator-facing text in Vietnamese.
- Add `SHIPPER` exactly as exposed by WMS; do not widen backend action permissions.
- Keep primary content as a table and selected record actions in the right-side panel.

---

### Task 1: Add typed Shipping contracts and API service

**Files:**
- Create: `src/features/shipping/services/shipping.service.ts`
- Modify: `tests/unit/wms-swagger-services.test.ts`

**Interfaces:**
- Produces `listShipments`, `getShipment`, `assignShipmentCarrier`, `updateShipmentStatus`, `listCarriers`, `getCarrier`, `createCarrier`, and `updateCarrier`.
- Defines `Shipment`, `Carrier`, status unions, query types, and mutation inputs matching the WMS Swagger DTOs.

- [ ] Write a failing service test that calls all eight endpoint shapes using mocked `apiClient`.
- [ ] Run `pnpm test -- tests/unit/wms-swagger-services.test.ts` and confirm the missing module error.
- [ ] Implement typed Axios calls, `unwrapApiData`, and `normalizeApiList` handling.
- [ ] Re-run the unit test and confirm it passes.

### Task 2: Align RBAC and navigation

**Files:**
- Modify: `src/lib/rbac.ts`
- Modify: `src/constants/routes.ts`
- Modify: `tests/unit/rbac.test.ts`

**Interfaces:**
- Produces `WmsRole` containing `SHIPPER` and `hasRouteAccess('/shipping', roles)`.
- Route visibility: `SHIPPER`, `MANAGER`, `ADMIN`; shipment actions: `SHIPPER`, `ADMIN`; carrier mutations: `MANAGER`, `ADMIN`.

- [ ] Write failing RBAC assertions for route visibility and action permissions.
- [ ] Run `pnpm test -- tests/unit/rbac.test.ts` and confirm the assertions fail.
- [ ] Add the role, Vietnamese label/description, route and sidebar navigation.
- [ ] Re-run the unit test and confirm it passes.

### Task 3: Build the Shipping workspace and route

**Files:**
- Create: `src/app/(dashboard)/shipping/page.tsx`
- Create: `src/features/shipping/components/shipping-client.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes the Task 1 service and Task 2 RBAC entries.
- Shipment tab supports pagination/filtering by status, order ID and carrier; row selection loads detail into a side panel; Shipper/Admin can assign an active carrier plus tracking number and advance status with optional note/failure reason.
- Carrier tab supports pagination/filtering by active status; Manager/Admin can create and edit carrier name, code, contact details, note and activity status.

- [ ] Write a failing browser test: a Shipper opens `/shipping`, sees a shipment, assigns a carrier, and updates its status; a Manager sees carrier create/edit actions but no shipment action controls.
- [ ] Run `pnpm test:e2e -- --grep shipping` and confirm the route is absent.
- [ ] Implement the two-tab workspace using the existing operations table, drawer/panel, dialogs, permission notices and API error formatting patterns.
- [ ] Re-run the targeted browser test and confirm it passes.

### Task 4: Verify the feature

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint` without `--fix`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm test:e2e -- --grep shipping`.
- [ ] Review `git diff` to ensure only Shipping UI, route/RBAC and its tests are included.

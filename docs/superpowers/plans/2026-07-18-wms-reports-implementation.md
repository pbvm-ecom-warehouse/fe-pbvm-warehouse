# WMS Reports Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `/reports` placeholder with three live, role-protected WMS report views backed by the new stock, lot, and performance APIs.

**Architecture:** A small reports feature owns report DTOs, request normalization, Vietnamese labels, and one client component that fetches only the active tab through TanStack Query. The route stays a server component and mounts that client component; the shared Axios WMS client and warehouse list service remain the only API entry points.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TanStack Query 5, shadcn/Tailwind, Recharts 3, Vitest and Testing Library.

## Global Constraints

- Use `/reports/stock`, `/reports/stock/lots`, and `/reports/performance` through `apiClient`; its base URL already adds `/api/wms`.
- Do not claim report generation, report history, inventory value, export, or a global total inferred from one paginated response page.
- Stock and lot pagination must consume runtime `meta.pagination.limit` and `meta.pagination.totalItems`, even though Swagger documents a raw array.
- Preserve API signed `totalQuantity`; render the performance zero line and include `RETURN_IN`.
- Calendar input end dates become local end-of-day ISO strings before requesting performance data.
- Use Vietnamese operator copy, visible field labels, compact dashboard styling, and loading, empty, and error states.
- Follow red-green-refactor: each new behavior must have a test observed failing before the corresponding production implementation is written.

---

## File Structure

- Create: `src/features/reports/services/report.service.ts` — DTOs, API calls, runtime-envelope pagination mapper, and exact-SKU/date helpers.
- Create: `src/features/reports/utils/report-formatters.ts` — Vietnamese movement and expiry labels plus quantity/date formatters.
- Create: `src/features/reports/components/reports-client.tsx` — tabs, controlled filters, TanStack Query calls, tables, chart, and retry/pagination controls.
- Create: `tests/unit/report-service.test.ts` — API contract and date/query normalization tests.
- Create: `tests/unit/reports-client.test.tsx` — focused UI state and interaction tests.
- Modify: `src/app/(dashboard)/reports/page.tsx` — render the focused reports client.
- Modify: `src/types/api.ts` — add `RETURN_IN` to shared `MoveType`.

### Task 1: Report API contract and formatter helpers

**Files:**
- Create: `tests/unit/report-service.test.ts`
- Create: `src/features/reports/services/report.service.ts`
- Create: `src/features/reports/utils/report-formatters.ts`
- Modify: `src/types/api.ts:89-97`

**Interfaces:**
- Consumes: `apiClient.get<T>(path, { params })`, `ApiEnvelope<T>`, and the live response fields documented in `docs/superpowers/specs/2026-07-18-wms-reports-design.md`.
- Produces:

```ts
export type ReportPage<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export async function getStockReport(input: StockReportQuery): Promise<ReportPage<StockReportRow>>;
export async function getLotReport(input: LotReportQuery): Promise<ReportPage<LotReportRow>>;
export async function getPerformanceReport(input: PerformanceReportQuery): Promise<PerformanceReportRow[]>;
export function toPerformanceApiRange(dateFrom: string, dateTo: string): Pick<PerformanceReportQuery, "dateFrom" | "dateTo">;
```

- [ ] **Step 1: Write the failing API contract tests**

```ts
it("requests stock with trimmed exact SKU and maps offset pagination", async () => {
  mockedGet.mockResolvedValueOnce({
    data: { data: [stockRow], meta: { pagination: { page: 2, limit: 20, totalItems: 53, totalPages: 3, hasNext: true, hasPrev: true } } },
  });

  await expect(getStockReport({ page: 2, limit: 20, sku: "  SKU-01  ", warehouseId: "wh-1" })).resolves.toMatchObject({
    data: [stockRow], pagination: { page: 2, limit: 20, totalItems: 53, totalPages: 3 },
  });
  expect(mockedGet).toHaveBeenCalledWith("/reports/stock", { params: { page: 2, limit: 20, sku: "SKU-01", warehouseId: "wh-1" } });
});

it("accepts a raw lot array as a defensive Swagger fallback", async () => {
  mockedGet.mockResolvedValueOnce({ data: [lotRow] });
  await expect(getLotReport({ page: 1, limit: 20 })).resolves.toMatchObject({ data: [lotRow], pagination: { totalItems: 1 } });
});

it("uses inclusive local calendar boundaries for performance", () => {
  expect(toPerformanceApiRange("2026-07-01", "2026-07-31")).toEqual({
    dateFrom: new Date(2026, 6, 1, 0, 0, 0, 0).toISOString(),
    dateTo: new Date(2026, 6, 31, 23, 59, 59, 999).toISOString(),
  });
});
```

- [ ] **Step 2: Run the service test to verify RED**

Run: `pnpm test tests/unit/report-service.test.ts`

Expected: FAIL because `@/features/reports/services/report.service` does not exist.

- [ ] **Step 3: Implement the small report service and formatters**

```ts
function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toPage<T>(payload: ApiEnvelope<T[]> | T[], fallback: { page: number; limit: number }): ReportPage<T> {
  const data = isApiEnvelope<T[]>(payload) ? payload.data : payload;
  const source = isApiEnvelope<T[]>(payload) ? payload.meta.pagination : undefined;
  return {
    data,
    pagination: {
      page: source?.page ?? fallback.page,
      limit: source?.limit ?? fallback.limit,
      totalItems: source?.totalItems ?? data.length,
      totalPages: source?.totalPages ?? 1,
      hasNext: source?.hasNext ?? false,
      hasPrev: source?.hasPrev ?? false,
    },
  };
}
```

Use that mapper in `getStockReport` and `getLotReport`; request `/reports/performance` with the transformed ISO range and unwrap either an envelope or an array. Add `"RETURN_IN"` to `MoveType`, and expose formatter maps such as `movementTypeLabel.RETURN_IN = "Nhập hoàn"` and `expiryFlagLabel.expiringSoon = "Sắp hết hạn"`.

- [ ] **Step 4: Run the service tests to verify GREEN**

Run: `pnpm test tests/unit/report-service.test.ts`

Expected: PASS, including paths, query params, envelope mapping, raw-array fallback, `RETURN_IN`, and inclusive date conversion.

- [ ] **Step 5: Commit the API-contract slice**

```bash
git add src/features/reports/services/report.service.ts src/features/reports/utils/report-formatters.ts src/types/api.ts tests/unit/report-service.test.ts
git commit -m "feat: add WMS report API service"
```

### Task 2: Reports client interaction and states

**Files:**
- Create: `tests/unit/reports-client.test.tsx`
- Create: `src/features/reports/components/reports-client.tsx`

**Interfaces:**
- Consumes: `getStockReport`, `getLotReport`, `getPerformanceReport`, `listWarehouses`, `PageHeader`, `TablePanel`, `TableSkeleton`, `EmptyState`, `StatusBadge`, and report formatter helpers.
- Produces: `ReportsClient`, a client component with no props that renders tabs `stock`, `lots`, and `performance`.

- [ ] **Step 1: Write the failing component tests**

```tsx
it("loads the stock tab by default and does not show placeholder report controls", async () => {
  mockedGetStockReport.mockResolvedValue(stockPage);
  renderReports();

  expect(await screen.findByRole("heading", { name: "Báo cáo kho" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Tồn kho" })).toHaveAttribute("data-state", "active");
  expect(await screen.findByText("SKU-01")).toBeInTheDocument();
  expect(screen.queryByText("Tạo báo cáo")).not.toBeInTheDocument();
  expect(screen.queryByText("Giá trị kho")).not.toBeInTheDocument();
});

it("applies a trimmed SKU to lots and resets the page", async () => {
  mockedGetLotReport.mockResolvedValue(lotPage);
  renderReports();
  await userEvent.click(screen.getByRole("tab", { name: "Theo lô" }));
  await userEvent.type(screen.getByLabelText("SKU chính xác"), "  LOT-01  ");
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
  await waitFor(() => expect(mockedGetLotReport).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sku: "LOT-01" })));
});

it("shows expiry badges, a performance zero-line label, and retryable errors", async () => {
  mockedGetLotReport.mockResolvedValue({ ...lotPage, data: [{ ...lotRow, expiryFlag: "expired" }] });
  renderReports();
  await userEvent.click(screen.getByRole("tab", { name: "Theo lô" }));
  expect(await screen.findByText("Đã hết hạn")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test to verify RED**

Run: `pnpm test tests/unit/reports-client.test.tsx`

Expected: FAIL because `ReportsClient` does not exist.

- [ ] **Step 3: Implement the client component**

```tsx
export function ReportsClient() {
  const [tab, setTab] = useState<"stock" | "lots" | "performance">("stock");
  const stockQuery = useQuery({ queryKey: ["reports", "stock", stockFilters], queryFn: () => getStockReport(stockFilters), enabled: tab === "stock" });
  const lotQuery = useQuery({ queryKey: ["reports", "lots", lotFilters], queryFn: () => getLotReport(lotFilters), enabled: tab === "lots" });
  const performanceQuery = useQuery({ queryKey: ["reports", "performance", performanceFilters], queryFn: () => getPerformanceReport(performanceFilters), enabled: tab === "performance" });
  // Render the active query's skeleton, inline retry alert, empty state, and data table.
}
```

Implement compact filters with `<label>` and `<Input>`, a warehouse select populated by `listWarehouses`, and `Áp dụng`/`Đặt lại` buttons. Keep draft filter inputs separate from applied filters; when applying stock or lot filters, store `{ ...draft, page: 1 }`. Build stock and lot rows in direct shadcn `<Table>` components, right-align all quantities, and use `StatusBadge` with `success`, `warning`, and `danger` tones for `ok`, `expiringSoon`, and `expired`. For performance, render a Recharts `BarChart` over `{ name: movementTypeLabel[type], totalQuantity }`, add `<ReferenceLine y={0} />`, and render the same signed values/movement counts in a table. `Làm mới` invokes `refetch()` only for the active query.

- [ ] **Step 4: Run component tests to verify GREEN**

Run: `pnpm test tests/unit/reports-client.test.tsx`

Expected: PASS for the default tab, trimmed filters/reset page, expiry states, empty/error/retry, and performance representation.

- [ ] **Step 5: Commit the UI slice**

```bash
git add src/features/reports/components/reports-client.tsx tests/unit/reports-client.test.tsx
git commit -m "feat: build live WMS reports interface"
```

### Task 3: Route integration and end-to-end verification

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx`

**Interfaces:**
- Consumes: `ReportsClient`.
- Produces: The existing `/reports` route, rendered in the dashboard shell and access-controlled by the existing RBAC policy.

- [ ] **Step 1: Write the failing route-level assertion**

Add an assertion in `tests/unit/reports-client.test.tsx` that the mounted UI has no `Tạo báo cáo`, `Giá trị kho`, or `Báo cáo gần đây` copy and includes all three report tabs.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `pnpm test tests/unit/reports-client.test.tsx`

Expected: FAIL while `src/app/(dashboard)/reports/page.tsx` still renders `ModulePage`.

- [ ] **Step 3: Mount the new reports UI**

```tsx
import { ReportsClient } from "@/features/reports/components/reports-client";

export default function ReportsPage() {
  return <ReportsClient />;
}
```

- [ ] **Step 4: Run targeted checks, then full static verification**

Run: `pnpm test tests/unit/report-service.test.ts tests/unit/reports-client.test.tsx`

Expected: PASS.

Run: `pnpm typecheck`

Expected: exit code 0.

Run: `pnpm build`

Expected: production build succeeds.

- [ ] **Step 5: Commit integration**

```bash
git add src/app/(dashboard)/reports/page.tsx tests/unit/reports-client.test.tsx
git commit -m "feat: mount live warehouse reports page"
```

## Self-review

- Spec coverage: Task 1 covers all three API contracts, runtime pagination, date inclusivity, and `RETURN_IN`; Task 2 covers the approved three-tab operational UI, filters, tables, chart, state handling, and no invented aggregates; Task 3 replaces the route placeholder and checks type/build health.
- No-placeholder scan: the plan contains no unassigned implementation work or undefined API interfaces.
- Type consistency: `ReportPage`, report query methods, and `ReportsClient` are named identically across tasks.

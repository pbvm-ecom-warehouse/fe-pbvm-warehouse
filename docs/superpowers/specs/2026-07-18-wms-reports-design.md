# WMS reports page design

Date: 2026-07-18

## Context

The WMS backend now exposes three report endpoints:

- `GET /api/wms/reports/stock`
- `GET /api/wms/reports/stock/lots`
- `GET /api/wms/reports/performance`

The current frontend report page is a static placeholder with "Tạo báo cáo",
"Giá trị kho", and an empty recent-report table. That no longer matches the
backend. The new page must connect to the live WMS API through the existing
shared API client and must not invent saved reports, value charts, exports, or
aggregate totals that the backend does not return.

## Users and goal

Primary users are `ADMIN` and `MANAGER` warehouse operators. They need a dense,
scan-friendly report page for checking current stock, lots nearing expiry, and
movement totals by operation type. The page remains under `/reports` and keeps
the existing dashboard shell and role access.

## Approved approach

Use one `/reports` page with three tabs:

- `Tồn kho`: stock by SKU and warehouse.
- `Theo lô`: stock by lot with expiry status and expiry warning.
- `Hiệu suất`: movement totals for a selected date range.

This was selected over separate routes and over a long page that renders all
reports at once. Tabs keep the route stable, avoid unnecessary API calls, and
match the way operators switch between related report views.

## API contract

### Stock report

Query parameters:

- `page`: offset page, default `1`
- `limit`: page size, default `20`, max `100`
- `warehouseId`: optional Mongo id
- `sku`: optional exact SKU

Response rows:

- `sku`
- `itemName`
- `warehouseId`
- `warehouseName`
- `onHand`
- `reserved`
- `expired`
- `available`

Runtime response uses the platform envelope:

```ts
{
  data: StockReportRow[];
  meta: {
    requestId: string;
    timestamp: string;
    pagination: {
      type: "offset";
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}
```

### Lot report

Query parameters:

- `page`
- `limit`
- `warehouseId`
- `sku`
- `status`: optional `ACTIVE` or `EXPIRED`

Response rows:

- `sku`
- `itemName`
- `lotNumber`
- `expiryDate`
- `warehouseId`
- `warehouseName`
- `quantity`
- `status`
- `expiryFlag`: `ok`, `expiringSoon`, or `expired`

### Performance report

Query parameters:

- `dateFrom`: ISO datetime, defaults to backend last 30 days
- `dateTo`: ISO datetime, defaults to now
- `warehouseId`
- `sku`

The frontend date inputs show calendar dates. Before calling the API,
`dateFrom` is converted to start-of-day local time and `dateTo` is converted to
end-of-day local time so the selected end date is included.

Response rows:

- `type`: `RECEIVE`, `PUTAWAY`, `ISSUE`, `ADJUST`, `SCRAP`,
  `PRINT_CONSUME`, `PRINT_OUTPUT`, or `RETURN_IN`
- `totalQuantity`: signed quantity from stock movements
- `movementCount`: number of matching movement records

Performance has no backend pagination.

## Page structure

The route `src/app/(dashboard)/reports/page.tsx` renders a focused report client
instead of `ModulePage`.

Proposed feature files:

- `src/features/reports/services/report.service.ts`
- `src/features/reports/components/reports-client.tsx`
- `src/features/reports/utils/report-formatters.ts`
- focused unit/component tests near the existing test conventions

The page header contains:

- Title: `Báo cáo kho`
- Subtitle: `Theo dõi tồn kho, hạn dùng và biến động nhập xuất.`
- Primary utility button: `Làm mới`

The old disabled `Tạo báo cáo` action is removed because the backend does not
support generated/saved report jobs.

## Flow and states

Entry point: authenticated `ADMIN` or `MANAGER` opens `/reports`.

Default state:

- `Tồn kho` tab is active.
- Page size defaults to backend default unless the user chooses another value.
- Stock and lot pages start at page `1`.
- Performance filters default to the last 30 calendar days in the UI.

Filtering:

- Warehouse uses the existing warehouse list API if available in the frontend.
- SKU is labeled as exact SKU and is trimmed before submit.
- Tab-specific filters are applied by an `Áp dụng` action to prevent firing a
  request on every keystroke.
- Changing filters resets the paginated tab to page `1`.
- `Làm mới` refetches the active tab using the current filters.

Loading:

- Use skeleton rows shaped like the table layout.
- Keep filters visible while data loads.

Empty:

- Stock: `Không có tồn kho phù hợp.`
- Lots: `Không có lô phù hợp.`
- Performance: `Không có biến động trong kỳ đã chọn.`

Error:

- Show an inline alert in the active tab with a retry action.
- Do not use `window.alert`.
- If the API returns unauthorized/forbidden, preserve existing auth handling
  from the shared client and show the direct error message returned to the UI.

## Components

### ReportsClient

Purpose: owns active tab, filter state, query keys, and refresh behavior.

Behavior:

- Uses TanStack Query.
- Fetches only the active tab by default.
- Keeps filter state local to each tab.
- Does not compute global totals from a single paginated page.

### ReportFilters

Purpose: compact filter bar for each tab.

Fields:

- Warehouse select
- Exact SKU input
- Status select for lots
- Date inputs for performance
- `Áp dụng` and `Đặt lại`

Accessibility:

- Every input has a visible label.
- Buttons have clear text and keyboard focus states.

### ReportTable

Purpose: table display for stock, lots, and performance rows.

Behavior:

- Uses existing table primitives and dashboard spacing.
- Numeric cells use tabular figures and right alignment.
- Long SKU, item, warehouse, and lot names wrap or truncate without breaking the
  table.
- Pagination uses backend `page`, `limit`, `totalItems`, `totalPages`,
  `hasNext`, and `hasPrev`.

### PerformanceChart

Purpose: visualize `totalQuantity` by movement type.

Behavior:

- Uses Recharts already present in the project.
- Displays signed quantities as returned by the backend.
- Shows movement labels in Vietnamese.
- Includes a zero reference line so negative movement types are clear.

## Styling rules

- Match the current operational dashboard style: restrained, dense, and
  readable.
- Use existing shadcn/Tailwind tokens and components.
- Keep cards at radius `8px` or less.
- Do not add marketing-style hero sections or decorative gradients.
- Prefer table density and useful empty/error states over decorative summaries.
- Use one accent color family from the existing theme and semantic status colors
  for expiry badges.

## Testing

Follow test-first implementation.

Service tests:

- Builds the three correct endpoint paths and query parameters.
- Maps report envelope pagination from `limit` and `totalItems`.
- Supports `RETURN_IN` in movement labels/types.
- Converts calendar date range to inclusive ISO datetimes for performance.
- Handles raw-array fallback defensively for the Swagger/documentation mismatch.

Component tests:

- Renders the three tabs.
- Default stock tab loads and shows rows.
- Filters submit with trimmed exact SKU and reset pagination.
- Lot expiry badges render `ok`, `expiringSoon`, and `expired`.
- Performance chart/table render signed quantities.
- Loading, empty, and error states are visible.

E2E or integration smoke:

- `ADMIN` or `MANAGER` can open `/reports`.
- `RECEIVER` remains blocked by existing role access.
- Mocked API responses prove the page no longer shows the old placeholder copy.

## Acceptance criteria

- `/reports` is no longer a placeholder.
- The page calls the new backend report APIs through the existing WMS client.
- Stock and lot tabs use backend pagination correctly.
- Performance tab shows date-filtered movement totals in a chart and table.
- No UI claims generated reports, saved reports, inventory value, or exports
  unless the backend later supports them.
- Loading, empty, error, and permission states are handled.
- Targeted unit/component tests pass, followed by typecheck/build verification.

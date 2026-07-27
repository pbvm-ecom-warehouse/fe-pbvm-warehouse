# Warehouse Map Editor 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay hai màn hình kho legacy bằng một editor 2D duy nhất dùng snapshot và batch API có revision.

**Architecture:** Service map API response sang domain layout đầy đủ và tạo
change-set bằng pure diff. Client giữ base/draft/history tại chỗ; canvas SVG chỉ
phát ra interaction, inspector chỉ phát ra patch, còn client điều phối undo,
redo, validation và save.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TanStack Query,
Axios, SVG, Tailwind/shadcn, Vitest, Testing Library.

## Global Constraints

- Không chạm vào thay đổi sản phẩm đang có trong worktree.
- Dùng `apiClient` và unwrap envelope `{ data, meta }`.
- Branch theo `error.code`, không theo message.
- Gate chỉ di chuyển, không resize.
- Manager/Admin được sửa; vai trò khác read-only.

---

### Task 1: Domain contract và batch service

**Files:**

- Modify: `src/types/api.ts`
- Modify: `src/features/warehouse-layout/services/warehouse-layout.service.ts`
- Create: `src/features/warehouse-layout/utils/warehouse-layout-operations.ts`
- Modify: `tests/unit/warehouse-layout-service.test.ts`
- Create: `tests/unit/warehouse-layout-operations.test.ts`

**Interfaces:**

- Consumes: backend `GET/PATCH /location/layout`.
- Produces: `fetchWarehouseLayout()`, `saveWarehouseLayout(request)`,
  `buildWarehouseLayoutOperations(base, draft)`.

- [ ] **Step 1: Viết test mapping snapshot đầy đủ**

Test phải chứng minh canvas/revision/shelves/rackTemplate từ server được giữ
nguyên và rack render dimensions được ráp từ rack template.

- [ ] **Step 2: Chạy test và xác nhận fail**

Run: `pnpm test -- tests/unit/warehouse-layout-service.test.ts`

- [ ] **Step 3: Cập nhật types và service**

Thêm `WarehouseLayoutShelf`, `WarehouseRackTemplate`,
`WarehouseLayoutOperation`, `SaveWarehouseLayoutResponse`; bỏ mọi suy luận
canvas/hard-code revision và bỏ CRUD/rack-template request legacy khỏi service.

- [ ] **Step 4: Viết test diff**

Cover create Zone → Rack → Shelf bằng ID tạm, update canvas/rack template,
update entity, và thứ tự delete Shelf → Rack → Zone.

- [ ] **Step 5: Implement pure diff và chạy test**

Run:
`pnpm test -- tests/unit/warehouse-layout-service.test.ts tests/unit/warehouse-layout-operations.test.ts`

### Task 2: Editor state và shell

**Files:**

- Create: `src/features/warehouse-layout/hooks/use-warehouse-editor.ts`
- Modify: `src/features/warehouse-layout/components/warehouse-map-client.tsx`
- Modify: `tests/unit/warehouse-map-client.test.tsx`

**Interfaces:**

- Consumes: service và diff từ Task 1.
- Produces: draft editing, undo/redo, create/delete, save/conflict state.

- [ ] **Step 1: Viết test UI cho legacy removal và draft save**

Assert không còn `Kích thước rack chuẩn`/`Sơ đồ kho` card, có toolbar `Lưu thay
đổi`, tool rail, và drag/patch không gọi API trước khi save.

- [ ] **Step 2: Chạy test và xác nhận fail**

Run: `pnpm test -- tests/unit/warehouse-map-client.test.tsx`

- [ ] **Step 3: Implement editor hook**

Hook giữ base/draft/undo/redo, commit interaction theo snapshot, tạo temp ID,
patch/delete entity và reset canonical layout sau save.

- [ ] **Step 4: Implement editor shell**

Header, tool rail, canvas workspace, inspector; `useMutation` chỉ gọi
`saveWarehouseLayout`. Xử lý code 409/422 và nút tải bản mới.

- [ ] **Step 5: Chạy test**

Run: `pnpm test -- tests/unit/warehouse-map-client.test.tsx`

### Task 3: Canvas tools và inspector

**Files:**

- Modify: `src/features/warehouse-layout/components/warehouse-floor-plan.tsx`
- Modify: `src/features/warehouse-layout/components/warehouse-layout-inspector.tsx`
- Create: `tests/unit/warehouse-floor-plan.test.tsx`

**Interfaces:**

- Consumes: `EditorTool`, `LayoutSelection`, draft layout.
- Produces: `onCreate(kind, point)`, move/resize interactions, zoom/pan controls,
  patches for selection/canvas/template.

- [ ] **Step 1: Viết tests cho add tool, gate no-resize và invalid highlight**

Run: `pnpm test -- tests/unit/warehouse-floor-plan.test.tsx`

- [ ] **Step 2: Thêm tool-aware canvas**

Blank click ở create tool snap tọa độ và phát `onCreate`; wheel/controls đổi
viewBox; hand tool pan; selection vẫn hỗ trợ drag/resize.

- [ ] **Step 3: Thay inspector legacy**

Inspector có trạng thái empty, property form, delete, rotate, settings canvas
và rack template; rack không expose resize riêng vì dimensions dùng template.

- [ ] **Step 4: Chạy tests liên quan**

Run:
`pnpm test -- tests/unit/warehouse-floor-plan.test.tsx tests/unit/warehouse-map-client.test.tsx`

### Task 4: Route canonical và verification

**Files:**

- Modify: `src/app/(dashboard)/locations/page.tsx`
- Modify: `src/app/(dashboard)/locations/map/page.tsx`
- Delete if unreferenced: legacy warehouse-structure UI files only after `rg`
  proves no remaining imports.
- Modify: editor tests as needed.

**Interfaces:**

- Consumes: Next.js server `redirect`.
- Produces: `/locations` render editor; `/locations/map` → `/locations`.

- [ ] **Step 1: Redirect route**

Render `WarehouseMapClient` tại `/locations`; dùng `redirect("/locations")`
trong page legacy `/locations/map`.

- [ ] **Step 2: Search legacy UI**

Run:
`rg -n "LocationStructureClient|Kích thước rack chuẩn|Áp dụng cho toàn bộ rack" src`

Expected: no reachable legacy warehouse page/form.

- [ ] **Step 3: Static verification**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

- [ ] **Step 4: Browser verification**

Start port 3101 and verify `/locations` renders the editor while
`/locations/map` redirects to `/locations`; the editor fills the content area;
tools, selection, move, resize, undo/redo and save are usable; no old
table/form/card remains.

- [ ] **Step 5: Review diff**

Run `git status --short` and `git diff --check`; confirm existing product files
are untouched by this feature.

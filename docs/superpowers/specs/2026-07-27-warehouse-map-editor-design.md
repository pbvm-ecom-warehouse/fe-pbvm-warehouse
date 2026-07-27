# Warehouse Map Editor 2D — Design

## Mục tiêu

Thay toàn bộ luồng quản lý kho legacy trong hai ảnh hiện tại bằng một màn hình
editor 2D duy nhất, thao tác giống công cụ thiết kế: chọn công cụ, thêm phần tử,
kéo thả, thay đổi kích thước, xoay, hoàn tác và lưu toàn bộ change-set một lần.

## Điều hướng

- `/locations` là alias và redirect server-side sang `/locations/map`.
- Sidebar `Kho` tiếp tục dùng URL `/locations`; người dùng được đưa thẳng vào
  editor, không còn thấy bảng `Kho tổng`.
- `/locations/map` render `WarehouseMapClient`.
- Component danh sách `LocationStructureClient` không còn nằm trong luồng Kho.

## Bố cục

Editor chiếm phần chiều cao còn lại của dashboard và gồm bốn vùng:

1. Header: tên kho, revision, trạng thái đã/chưa lưu, Undo, Redo, Lưu.
2. Tool rail trái: Chọn, Di chuyển, Khu vực, Rack, Lối đi, Cổng.
3. Canvas giữa: SVG có grid theo mét, zoom, pan, chọn, kéo, resize và rotate.
4. Inspector phải: thuộc tính phần tử, cài đặt canvas/rack template và xoá.

Form `Kích thước rack chuẩn` và card `Sơ đồ kho` legacy bị loại bỏ. Rack template
được chỉnh trong tab Cài đặt của inspector.

## Trạng thái và thao tác

- Snapshot tải từ `GET /location/layout` là canonical state.
- Editor giữ `baseLayout`, `draftLayout`, undo stack và redo stack.
- Mọi tương tác chỉ cập nhật draft; không gọi CRUD API trong lúc kéo.
- ID phần tử mới có dạng `tmp:<crypto.randomUUID()>`.
- Tạo rack yêu cầu có zone được chọn hoặc zone chứa điểm click.
- Khi tạo rack, editor tạo các shelf tương ứng với `rackTemplate.levelCount`.
- Xoá rack mới hoặc rack cũ đồng thời đưa shelf của rack vào change-set trước
  operation xoá rack. Xoá zone chỉ được phép khi không còn rack trong zone.

## Save change-set

`buildWarehouseLayoutOperations(base, draft)` tạo operation theo thứ tự:

1. UPDATE canvas và rack template.
2. CREATE zone.
3. CREATE rack.
4. CREATE shelf.
5. CREATE aisle và gate.
6. UPDATE entity đã tồn tại.
7. DELETE shelf.
8. DELETE rack.
9. DELETE zone, aisle và gate.

Request:

```ts
PATCH /location/layout
{
  expectedRevision: base.revision,
  operations: WarehouseLayoutOperation[]
}
```

Sau khi lưu, editor thay toàn bộ draft/base bằng `response.layout`, xoá history
và selection không còn tồn tại.

## Lỗi

- `409 LAYOUT_REVISION_CONFLICT`: giữ draft, hiển thị banner có revision hiện
  tại và nút `Tải bản mới`. Không tự ghi đè.
- `422 LAYOUT_VALIDATION_FAILED`: giữ draft, map `issues` vào phần tử, viền đỏ
  trên canvas và hiển thị danh sách lỗi trong inspector/banner.
- Delete guard và lỗi code unique dùng `error.code`, không dựa vào message tiếng
  Việt.

## Quyền

- `MANAGER` và `ADMIN` được chỉnh sửa/lưu.
- Vai trò khác xem canvas ở chế độ read-only; tool tạo, inspector input và nút
  lưu bị vô hiệu.

## Ngoài phạm vi

- Không mở rộng kích thước Gate; gate vẫn là marker x/y.
- Không thay đổi luồng điều hướng put-away/rack elevation.
- Không thay đổi code sản phẩm đang có trong worktree.


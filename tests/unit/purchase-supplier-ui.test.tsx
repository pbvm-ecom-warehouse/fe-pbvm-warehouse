import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PurchaseOrdersClient } from "@/features/purchases/components/purchase-orders-client";
import { SupplierItemsClient } from "@/features/suppliers/components/supplier-items-client";
import { SuppliersClient } from "@/features/suppliers/components/suppliers-client";

const sessionRoleState = vi.hoisted(() => ({
  roles: ["MANAGER"],
}));

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => ({
    id: "manager-1",
    name: "Manager",
    roles: sessionRoleState.roles,
    tenantId: "demo",
    type: "user",
  }),
}));

vi.mock(
  "@/features/purchases/services/purchase-order.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/purchases/services/purchase-order.service")
      >();

    return {
      ...actual,
      createPurchaseOrder: vi.fn(),
      getPurchaseOrder: vi.fn(),
      listPurchaseOrders: vi.fn(),
      listReceivingPurchaseOrders: vi.fn(),
    };
  },
);

vi.mock(
  "@/features/purchases/services/goods-receipt-note.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/purchases/services/goods-receipt-note.service")
      >();

    return {
      ...actual,
      approveGoodsReceiptNote: vi.fn(),
      confirmGoodsReceiptNote: vi.fn(),
      createGoodsReceiptNote: vi.fn(),
      listGoodsReceiptNotes: vi.fn(),
      uploadGoodsReceiptNoteImage: vi.fn(),
    };
  },
);

vi.mock(
  "@/features/suppliers/services/supplier.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/suppliers/services/supplier.service")
      >();

    return {
      ...actual,
      changeSupplierStatus: vi.fn(),
      createSupplier: vi.fn(),
      deleteSupplier: vi.fn(),
      getSupplier: vi.fn(),
      getSupplierItem: vi.fn(),
      listSupplierItemsBySupplier: vi.fn(),
      listSuppliers: vi.fn(),
      updateSupplier: vi.fn(),
      updateSupplierItem: vi.fn(),
      upsertSupplierItem: vi.fn(),
    };
  },
);

vi.mock(
  "@/features/products/services/warehouse-items.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/products/services/warehouse-items.service")
      >();

    return {
      ...actual,
      getWarehouseItem: vi.fn(),
      listWarehouseItems: vi.fn(),
    };
  },
);

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const purchaseService =
  await import("@/features/purchases/services/purchase-order.service");
const grnService =
  await import("@/features/purchases/services/goods-receipt-note.service");
const supplierService =
  await import("@/features/suppliers/services/supplier.service");
const warehouseItemService =
  await import("@/features/products/services/warehouse-items.service");

const mockedListPurchaseOrders = vi.mocked(purchaseService.listPurchaseOrders);
const mockedListReceivingPurchaseOrders = vi.mocked(
  purchaseService.listReceivingPurchaseOrders,
);
const mockedGetPurchaseOrder = vi.mocked(purchaseService.getPurchaseOrder);
const mockedListGrns = vi.mocked(grnService.listGoodsReceiptNotes);
const mockedCreateGrn = vi.mocked(grnService.createGoodsReceiptNote);
const mockedUploadGrnImage = vi.mocked(grnService.uploadGoodsReceiptNoteImage);
const mockedListSuppliers = vi.mocked(supplierService.listSuppliers);
const mockedGetSupplier = vi.mocked(supplierService.getSupplier);
const mockedUpsertSupplierItem = vi.mocked(supplierService.upsertSupplierItem);
const mockedListSupplierItems = vi.mocked(
  supplierService.listSupplierItemsBySupplier,
);
const mockedGetWarehouseItem = vi.mocked(warehouseItemService.getWarehouseItem);
const mockedGetSupplierItem = vi.mocked(supplierService.getSupplierItem);
const mockedListWarehouseItems = vi.mocked(
  warehouseItemService.listWarehouseItems,
);

const supplier = {
  code: "NCC-001",
  createdAt: "2026-07-01T00:00:00.000Z",
  id: "sup-1",
  name: "Công ty Minh Long",
  status: "ACTIVE" as const,
  updatedAt: "2026-07-23T00:00:00.000Z",
};

const supplierItem = {
  id: "si-1",
  isActive: true,
  itemId: "item-1",
  purchasePrice: 15000,
  supplierId: "sup-1",
  supplierItemCode: "ML-001",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

const purchaseOrder = {
  createdAt: "2026-07-23T00:00:00.000Z",
  id: "po-1",
  items: [
    {
      expectedQty: 10,
      itemId: "item-1",
      itemName: "Ly nhựa 500 ml",
      sku: "SKU-001",
      unit: "cái",
      unitPrice: 15000,
    },
  ],
  orderDate: "2026-07-23T00:00:00.000Z",
  poNumber: "PO-001",
  // BE gắn sẵn supplier summary (attachDisplayInfo) — FE không cần tra thêm getSupplier().
  supplier: {
    id: "sup-1",
    code: "NCC-001",
    name: "Công ty Minh Long",
    status: "ACTIVE",
  },
  status: "DRAFT" as const,
  supplierId: "sup-1",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

const goodsReceiptNote = {
  createdAt: "2026-07-23T00:00:00.000Z",
  grnNumber: "GRN-001",
  id: "grn-1",
  images: [],
  items: [
    {
      actualQty: 10,
      itemId: "item-1",
      itemName: "Ly nhựa 500 ml",
      sku: "SKU-001",
      unit: "cái",
    },
  ],
  purchaseOrderId: "po-1",
  purchaseOrderNumber: "PO-001",
  supplierName: "Công ty Minh Long",
  status: "CONFIRMED" as const,
  updatedAt: "2026-07-23T00:00:00.000Z",
};

function renderWithQueryClient(component: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
}

describe("purchase and supplier UX", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
    vi.clearAllMocks();
    sessionRoleState.roles = ["MANAGER"];
    mockedListSuppliers.mockResolvedValue({
      data: [supplier],
      limit: 20,
      page: 1,
      total: 1,
    });
    mockedGetSupplier.mockResolvedValue({
      ...supplier,
      address: "123 Lê Văn Lương, Quận 7",
      contactName: undefined,
      email: undefined,
      note: undefined,
      phone: undefined,
      status: "INACTIVE",
      taxCode: undefined,
    });
    mockedListSupplierItems.mockResolvedValue([]);
    mockedGetSupplierItem.mockResolvedValue(supplierItem);
    mockedListPurchaseOrders.mockResolvedValue({
      data: [purchaseOrder],
      limit: 20,
      page: 1,
      total: 1,
    });
    mockedGetPurchaseOrder.mockResolvedValue(purchaseOrder);
    mockedListReceivingPurchaseOrders.mockResolvedValue({
      data: [
        {
          id: "po-1",
          poNumber: "PO-001",
          supplierName: "Công ty Minh Long",
          items: [
            {
              itemId: "item-1",
              itemName: "Ly nhựa 500 ml",
              sku: "SKU-001",
              unit: "cái",
              expectedQty: 10,
              receivedQty: 0,
              remainingQty: 10,
            },
          ],
        },
      ],
      limit: 20,
      page: 1,
      total: 1,
    });
    mockedListGrns.mockResolvedValue({
      data: [],
      limit: 50,
      page: 1,
      total: 0,
    });
    mockedCreateGrn.mockResolvedValue({
      ...goodsReceiptNote,
      id: "grn-created",
      images: [],
      status: "DRAFT",
    });
    mockedUploadGrnImage.mockResolvedValue({
      ...goodsReceiptNote,
      id: "grn-created",
      images: ["https://cdn.example/grn.jpg"],
      status: "DRAFT",
    });
    mockedGetWarehouseItem.mockResolvedValue({
      createdAt: "2026-07-01T00:00:00.000Z",
      id: "item-1",
      isActive: true,
      isPerishable: true,
      name: "Ly nhựa 500 ml",
      sku: "SKU-001",
      type: "CUP_BLANK",
      unit: "cái",
      updatedAt: "2026-07-23T00:00:00.000Z",
    });
    mockedListWarehouseItems.mockResolvedValue({
      data: [],
      limit: 100,
      page: 1,
      total: 0,
    });
  });

  it("suggests a supplier code until the user edits the code manually", async () => {
    renderWithQueryClient(<SuppliersClient />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Tạo nhà cung cấp" }),
    );
    fireEvent.change(screen.getByLabelText("Tên NCC"), {
      target: { value: "Công ty Minh Long" },
    });
    expect(screen.getByLabelText("Mã NCC")).toHaveValue("CML");

    fireEvent.change(screen.getByLabelText("Mã NCC"), {
      target: { value: "ML-01" },
    });
    fireEvent.change(screen.getByLabelText("Tên NCC"), {
      target: { value: "Công ty Minh Long Việt Nam" },
    });
    expect(screen.getByLabelText("Mã NCC")).toHaveValue("ML-01");
  });

  it("shows supplier detail action and link to supplier-item management", async () => {
    renderWithQueryClient(<SuppliersClient />);

    expect(
      await screen.findByRole("link", {
        name: "Gán mặt hàng NCC",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Công ty Minh Long")).toBeVisible();
  });

  it("selects supplier items from refreshed warehouse-item options", async () => {
    mockedListSuppliers.mockResolvedValue({
      data: [supplier],
      limit: 100,
      page: 1,
      total: 1,
    });
    mockedListWarehouseItems.mockResolvedValue({
      data: [
        {
          createdAt: "2026-07-01T00:00:00.000Z",
          id: "item-1",
          isActive: true,
          isPerishable: false,
          name: "Ly nhựa 500 ml",
          sku: "SKU-001",
          type: "CUP_BLANK",
          unit: "cái",
          updatedAt: "2026-07-23T00:00:00.000Z",
        },
      ],
      limit: 100,
      page: 1,
      total: 1,
    });
    mockedListSupplierItems.mockResolvedValue([]);
    mockedUpsertSupplierItem.mockResolvedValue(supplierItem);
    renderWithQueryClient(<SupplierItemsClient />);

    fireEvent.click(
      await screen.findByRole("combobox", { name: "Nhà cung cấp" }),
    );
    fireEvent.click(
      await screen.findByRole("option", {
        name: /Công ty Minh Long/i,
      }),
    );
    fireEvent.click(
      await screen.findByRole("combobox", { name: "Mặt hàng kho" }),
    );
    fireEvent.click(
      await screen.findByRole("option", {
        name: /SKU-001.*Ly nhựa 500 ml/i,
      }),
    );
    fireEvent.change(screen.getByLabelText("Giá nhập"), {
      target: { value: "15000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu mặt hàng" }));

    await waitFor(() =>
      expect(mockedUpsertSupplierItem).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "item-1", purchasePrice: 15000 }),
      ),
    );
  });
  it("loads authoritative supplier detail and displays its selected status", async () => {
    renderWithQueryClient(<SuppliersClient />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Xem chi tiết nhà cung cấp Công ty Minh Long",
      }),
    );

    await waitFor(() =>
      expect(mockedGetSupplier).toHaveBeenCalledWith("sup-1"),
    );
    expect(await screen.findByText("123 Lê Văn Lương, Quận 7")).toBeVisible();
    expect(screen.getAllByText("Ngưng dùng").at(-1)).toBeVisible();
  });
  it("loads only active items of the selected supplier and fills the PO line", async () => {
    mockedListSupplierItems.mockResolvedValue([
      {
        ...supplierItem,
        leadTimeDays: 5,
        minOrderQty: 24,
      },
      {
        ...supplierItem,
        id: "si-inactive",
        isActive: false,
        itemId: "item-inactive",
        purchasePrice: 99000,
      },
    ]);
    mockedGetWarehouseItem.mockImplementation(async (itemId) => ({
      createdAt: "2026-07-01T00:00:00.000Z",
      id: itemId,
      isActive: true,
      isPerishable: false,
      name:
        itemId === "item-inactive"
          ? "Mặt hàng ngưng báo giá"
          : "Ly nhựa 500 ml",
      sku: itemId === "item-inactive" ? "SKU-INACTIVE" : "SKU-001",
      type: "CUP_BLANK",
      unit: "cái",
      updatedAt: "2026-07-23T00:00:00.000Z",
    }));

    renderWithQueryClient(<PurchaseOrdersClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Tạo đơn mua" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("purchase-order-dialog-body")).toHaveClass(
      "overflow-y-auto",
    );
    expect(screen.getByText("Mặt hàng", { selector: "label" })).toBeVisible();
    expect(screen.getByText("SKU", { selector: "label" })).toBeVisible();
    expect(screen.getByText("Số lượng", { selector: "label" })).toBeVisible();
    expect(screen.getByText("Đơn vị", { selector: "label" })).toBeVisible();
    expect(screen.getByText("Đơn giá", { selector: "label" })).toBeVisible();
    expect(screen.getByLabelText("Ngày dự kiến").parentElement).not.toHaveClass(
      "md:col-span-2",
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Nhà cung cấp" }));
    fireEvent.click(
      await screen.findByRole("option", { name: /Công ty Minh Long/i }),
    );

    await waitFor(() =>
      expect(mockedListSupplierItems).toHaveBeenCalledWith("sup-1"),
    );
    await waitFor(() =>
      expect(mockedGetWarehouseItem).toHaveBeenCalledWith("item-1"),
    );
    expect(mockedGetWarehouseItem).not.toHaveBeenCalledWith("item-inactive");

    fireEvent.click(screen.getByRole("combobox", { name: "Mặt hàng dòng 1" }));
    expect(
      screen.queryByRole("option", { name: /Mặt hàng ngưng báo giá/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("option", { name: /Ly nhựa 500 ml.*SKU-001/i }),
    );

    expect(
      screen.getByRole("combobox", { name: "Mặt hàng dòng 1" }),
    ).toHaveTextContent("Ly nhựa 500 ml");
    expect(screen.getByLabelText("SKU dòng 1")).toHaveValue("SKU-001");
    expect(screen.getByLabelText("Số lượng dòng 1")).toHaveValue(24);
    expect(screen.getByLabelText("Đơn vị dòng 1")).toHaveValue("cái");
    expect(screen.getByLabelText("Đơn giá dòng 1")).toHaveValue(15000);
    expect(mockedListWarehouseItems).not.toHaveBeenCalled();
  });

  it("keeps PO detail read-only and gives managers only GRN approval", async () => {
    mockedListGrns.mockResolvedValue({
      data: [goodsReceiptNote],
      limit: 50,
      page: 1,
      total: 1,
    });

    renderWithQueryClient(<PurchaseOrdersClient />);

    const detailButton = await screen.findByRole("button", {
      name: "Xem chi tiết đơn mua PO-001",
    });
    fireEvent.click(detailButton);

    const detailDialog = await screen.findByRole("dialog", {
      name: "Chi tiết đơn mua",
    });
    expect(
      screen.queryByRole("button", { name: "Tạo phiếu nhập" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(detailDialog).getByRole("button", { name: "Close" }),
    );

    const grnTab = screen.getByRole("tab", { name: "Phiếu nhập" });
    fireEvent.mouseDown(grnTab, { button: 0, ctrlKey: false });
    fireEvent.click(grnTab);
    await waitFor(() =>
      expect(grnTab).toHaveAttribute("aria-selected", "true"),
    );
    expect(await screen.findByRole("button", { name: "Duyệt" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Tạo phiếu nhập" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xác nhận" }),
    ).not.toBeInTheDocument();
  });

  it("lets admins create and confirm GRNs from the GRN tab", async () => {
    sessionRoleState.roles = ["ADMIN"];
    mockedListGrns.mockResolvedValue({
      data: [{ ...goodsReceiptNote, status: "DRAFT" }],
      limit: 50,
      page: 1,
      total: 1,
    });

    renderWithQueryClient(<PurchaseOrdersClient />);
    const grnTab = await screen.findByRole("tab", { name: "Phiếu nhập" });
    fireEvent.mouseDown(grnTab, { button: 0, ctrlKey: false });
    fireEvent.click(grnTab);
    await waitFor(() =>
      expect(grnTab).toHaveAttribute("aria-selected", "true"),
    );

    expect(
      await screen.findByRole("button", { name: "Xác nhận" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Duyệt" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));

    expect(screen.getByText("Đơn mua", { selector: "label" })).toBeVisible();
    expect(
      await screen.findByText("Tên mặt hàng", { selector: "label" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Tên mặt hàng phiếu nhập dòng 1")).toHaveValue(
      "Ly nhựa 500 ml",
    );
    expect(screen.getByText("SKU", { selector: "label" })).toBeVisible();
    expect(
      screen.getByText("Số lượng thực nhập", { selector: "label" }),
    ).toBeVisible();
    expect(screen.getByText("Đơn vị", { selector: "label" })).toBeVisible();
    expect(screen.getByText("Mã lô", { selector: "label" })).toBeVisible();
    // isPerishable chỉ tra được sau khi getWarehouseItem (query riêng, enabled khi dialog mở)
    // resolve xong — chờ input trở thành required thay vì assert ngay lập tức.
    await waitFor(() =>
      expect(screen.getByLabelText("Mã lô phiếu nhập dòng 1")).toBeRequired(),
    );
    expect(
      screen.getByText("Hạn sử dụng", { selector: "label" }),
    ).toBeVisible();
    expect(screen.getByText("Ghi chú", { selector: "label" })).toBeVisible();
  });

  it("BE luôn trả sẵn supplier trong PO response — không cần fallback getSupplier theo supplierId", async () => {
    mockedListSuppliers.mockResolvedValue({
      data: [],
      limit: 100,
      page: 1,
      total: 0,
    });

    renderWithQueryClient(<PurchaseOrdersClient />);

    expect(await screen.findByText(/Công ty Minh Long/)).toBeInTheDocument();
    expect(screen.queryByText("sup-1")).not.toBeInTheDocument();
    expect(mockedGetSupplier).not.toHaveBeenCalled();
  });

  it("allows receivers to create and confirm GRNs without purchase-order creation or approval", async () => {
    sessionRoleState.roles = ["RECEIVER"];
    mockedListGrns.mockResolvedValue({
      data: [{ ...goodsReceiptNote, status: "DRAFT" }],
      limit: 50,
      page: 1,
      total: 1,
    });

    renderWithQueryClient(<PurchaseOrdersClient />);

    expect(
      await screen.findByRole("tab", { name: "Phiếu nhập" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Tạo đơn mua" }),
    ).not.toBeInTheDocument();

    const grnTab = screen.getByRole("tab", { name: "Phiếu nhập" });
    fireEvent.mouseDown(grnTab, { button: 0, ctrlKey: false });
    fireEvent.click(grnTab);
    await waitFor(() =>
      expect(grnTab).toHaveAttribute("aria-selected", "true"),
    );

    expect(
      await screen.findByRole("button", { name: "Tạo phiếu nhập" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Xác nhận" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Duyệt" }),
    ).not.toBeInTheDocument();
  });

  it("shows PO and supplier context around GRN evidence and uploads images after creating the GRN", async () => {
    sessionRoleState.roles = ["ADMIN"];

    renderWithQueryClient(<PurchaseOrdersClient />);

    const grnTab = await screen.findByRole("tab", { name: "Phiếu nhập" });
    fireEvent.mouseDown(grnTab, { button: 0, ctrlKey: false });
    fireEvent.click(grnTab);
    await waitFor(() =>
      expect(grnTab).toHaveAttribute("aria-selected", "true"),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Tạo phiếu nhập" }),
    );

    expect((await screen.findAllByText("Số đơn mua")).length).toBeGreaterThan(
      0,
    );
    expect((await screen.findAllByText("PO-001")).length).toBeGreaterThan(0);
    expect(screen.getByText("NCC")).toBeInTheDocument();
    expect(screen.getAllByText(/Công ty Minh Long/).length).toBeGreaterThan(0);
    expect(screen.getByText("Ảnh minh chứng cho PO-001")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ảnh sẽ được lưu vào phiếu nhập tạo từ PO-001 của .*Công ty Minh Long/,
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mã lô phiếu nhập dòng 1"), {
      target: { value: "LOT-1" },
    });
    fireEvent.change(screen.getByLabelText("Hạn sử dụng phiếu nhập dòng 1"), {
      target: { value: "2026-12-31" },
    });
    const imageInput = screen.getByLabelText("Ảnh minh chứng cho PO-001");
    fireEvent.change(imageInput, {
      target: {
        files: [new File(["image"], "receipt.webp", { type: "image/webp" })],
      },
    });
    expect(await screen.findByText("receipt.webp")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));

    await waitFor(() =>
      expect(mockedCreateGrn).toHaveBeenCalledWith(
        expect.objectContaining({ purchaseOrderId: "po-1" }),
      ),
    );
    await waitFor(() =>
      expect(mockedUploadGrnImage).toHaveBeenCalledWith(
        "grn-created",
        expect.any(File),
      ),
    );
    expect(mockedCreateGrn.mock.invocationCallOrder[0]).toBeLessThan(
      mockedUploadGrnImage.mock.invocationCallOrder[0],
    );
  });
});

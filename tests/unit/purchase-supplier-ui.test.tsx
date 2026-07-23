import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PurchaseOrdersClient } from "@/features/purchases/components/purchase-orders-client";
import { SuppliersClient } from "@/features/suppliers/components/suppliers-client";

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => ({
    id: "manager-1",
    name: "Manager",
    roles: ["MANAGER"],
    tenantId: "demo",
    type: "user",
    warehouseId: "wh-1",
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
  "@/features/warehouse-structure/services/warehouse-structure.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/warehouse-structure/services/warehouse-structure.service")
      >();

    return {
      ...actual,
      listWarehouses: vi.fn(),
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
const warehouseService =
  await import("@/features/warehouse-structure/services/warehouse-structure.service");
const warehouseItemService =
  await import("@/features/products/services/warehouse-items.service");

const mockedListPurchaseOrders = vi.mocked(purchaseService.listPurchaseOrders);
const mockedGetPurchaseOrder = vi.mocked(purchaseService.getPurchaseOrder);
const mockedListGrns = vi.mocked(grnService.listGoodsReceiptNotes);
const mockedListSuppliers = vi.mocked(supplierService.listSuppliers);
const mockedListSupplierItems = vi.mocked(
  supplierService.listSupplierItemsBySupplier,
);
const mockedGetSupplierItem = vi.mocked(supplierService.getSupplierItem);
const mockedListWarehouses = vi.mocked(warehouseService.listWarehouses);
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
      sku: "SKU-001",
      unit: "cái",
      unitPrice: 15000,
    },
  ],
  orderDate: "2026-07-23T00:00:00.000Z",
  poNumber: "PO-001",
  status: "DRAFT" as const,
  supplierId: "sup-1",
  updatedAt: "2026-07-23T00:00:00.000Z",
  warehouseId: "wh-1",
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
    vi.clearAllMocks();
    mockedListSuppliers.mockResolvedValue({
      data: [supplier],
      limit: 20,
      page: 1,
      total: 1,
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
    mockedListGrns.mockResolvedValue({
      data: [],
      limit: 50,
      page: 1,
      total: 0,
    });
    mockedListWarehouses.mockResolvedValue([
      {
        address: "Kho chính",
        createdAt: "2026-07-01T00:00:00.000Z",
        id: "wh-1",
        isActive: true,
        name: "Kho trung tâm",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
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

  it("shows explicit supplier and supplier-item detail actions", async () => {
    mockedListSupplierItems.mockResolvedValue([supplierItem]);

    renderWithQueryClient(<SuppliersClient />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Xem chi tiết nhà cung cấp Công ty Minh Long",
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Xem chi tiết mặt hàng NCC item-1",
      }),
    ).toBeInTheDocument();
  });

  it("uses a non-horizontal purchase dialog with visible item labels and server search", async () => {
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

    fireEvent.click(screen.getByRole("combobox", { name: "Mặt hàng dòng 1" }));
    fireEvent.change(
      await screen.findByPlaceholderText("Tìm SKU hoặc tên mặt hàng"),
      { target: { value: "PET" } },
    );

    await waitFor(
      () =>
        expect(mockedListWarehouseItems).toHaveBeenLastCalledWith({
          isActive: true,
          limit: 100,
          page: 1,
          search: "PET",
        }),
      { timeout: 1000 },
    );
  });

  it("shows an explicit purchase detail action and visible GRN row labels", async () => {
    renderWithQueryClient(<PurchaseOrdersClient />);

    expect(
      await screen.findByRole("button", {
        name: "Xem chi tiết đơn mua PO-001",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));

    expect(
      screen.getByText("Mã mặt hàng", { selector: "label" }),
    ).toBeVisible();
    expect(screen.getByText("SKU", { selector: "label" })).toBeVisible();
    expect(
      screen.getByText("Số lượng thực nhập", { selector: "label" }),
    ).toBeVisible();
    expect(screen.getByText("Đơn vị", { selector: "label" })).toBeVisible();
    expect(screen.getByText("Mã lô", { selector: "label" })).toBeVisible();
    expect(
      screen.getByText("Hạn sử dụng", { selector: "label" }),
    ).toBeVisible();
    expect(screen.getByText("Ghi chú", { selector: "label" })).toBeVisible();
  });
});

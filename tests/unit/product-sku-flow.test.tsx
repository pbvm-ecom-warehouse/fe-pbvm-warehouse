import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AttributeOptionsAdminPanel } from "@/features/products/components/attribute-options-admin-dialog";
import { CreateWarehouseItemPanel } from "@/features/products/components/create-warehouse-item-panel";

vi.mock(
  "@/features/products/services/warehouse-items.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/products/services/warehouse-items.service")
      >();
    return {
      ...actual,
      createAttributeOption: vi.fn(),
      createWarehouseItem: vi.fn(),
      getSkuTemplate: vi.fn(),
      listAttributeOptions: vi.fn(),
      previewWarehouseItemSku: vi.fn(),
    };
  },
);

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const service =
  await import("@/features/products/services/warehouse-items.service");
const mockedCreateAttributeOption = vi.mocked(service.createAttributeOption);
const mockedGetSkuTemplate = vi.mocked(service.getSkuTemplate);
const mockedListAttributeOptions = vi.mocked(service.listAttributeOptions);
const mockedPreviewWarehouseItemSku = vi.mocked(
  service.previewWarehouseItemSku,
);

function renderWithQueryClient(component: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
}

describe("product SKU creation", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSkuTemplate.mockResolvedValue({
      fields: [{ key: "MATERIAL", required: true }],
      itemType: "CUP_BLANK",
      kind: "template",
      templateId: "CUP_BLANK",
    });
    mockedListAttributeOptions.mockResolvedValue([]);
    mockedPreviewWarehouseItemSku.mockResolvedValue({ sku: "MAT-RAW" });
  });

  it("loads only the selected attribute group in the SKU option admin", async () => {
    mockedGetSkuTemplate.mockResolvedValue({
      fields: [{ key: "MATERIAL" }],
      itemType: "CUP_BLANK",
      kind: "template",
      prefix: "CUP",
      templateId: "cup-template",
    });

    renderWithQueryClient(<AttributeOptionsAdminPanel />);
    await waitFor(() => expect(mockedListAttributeOptions).toHaveBeenCalled());

    expect(mockedGetSkuTemplate).toHaveBeenCalledWith("CUP_BLANK");
    expect(mockedListAttributeOptions).toHaveBeenCalledTimes(1);
  });

  it("uses the live PACKAGING template fields in the SKU option admin", async () => {
    mockedGetSkuTemplate.mockImplementation(async (type) =>
      type === "PACKAGING"
        ? {
            fields: [
              { key: "PACKAGING_CATEGORY", required: true },
              { key: "SIZE", required: false },
              { key: "COLOR", required: false },
            ],
            itemType: "PACKAGING",
            kind: "template",
            templateId: "PACKAGING",
          }
        : {
            fields: [{ key: "MATERIAL", required: true }],
            itemType: "CUP_BLANK",
            kind: "template",
            templateId: "CUP_BLANK",
          },
    );

    renderWithQueryClient(<AttributeOptionsAdminPanel />);
    await waitFor(() => expect(mockedListAttributeOptions).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("combobox", { name: "Loại mặt hàng" }));
    fireEvent.click(await screen.findByRole("option", { name: "Bao bì" }));

    await waitFor(() =>
      expect(mockedGetSkuTemplate).toHaveBeenCalledWith("PACKAGING"),
    );

    fireEvent.click(await screen.findByRole("combobox", { name: "Nhóm thuộc tính" }));

    expect(await screen.findByRole("option", { name: "Nhóm bao bì" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Kích thước" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Màu sắc" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "Kiểu bao bì" }),
    ).not.toBeInTheDocument();
  });

  it("allows admins to create category attribute options", async () => {
    mockedGetSkuTemplate.mockImplementation(async (type) =>
      type === "MATERIAL"
        ? {
            fields: [{ key: "MATERIAL_CATEGORY", required: true }],
            itemType: "MATERIAL",
            kind: "template",
            templateId: "MATERIAL",
          }
        : {
            fields: [{ key: "MATERIAL", required: true }],
            itemType: "CUP_BLANK",
            kind: "template",
            templateId: "CUP_BLANK",
          },
    );
    mockedCreateAttributeOption.mockResolvedValue({
      code: "POWDER",
      id: "category-powder",
      isActive: true,
      key: "MATERIAL_CATEGORY",
      name: "Bột",
      sortOrder: 0,
    });

    renderWithQueryClient(<AttributeOptionsAdminPanel />);
    await waitFor(() => expect(mockedListAttributeOptions).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("combobox", { name: "Loại mặt hàng" }));
    fireEvent.click(await screen.findByRole("option", { name: "Nguyên liệu" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Nhóm thuộc tính" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "Nhóm nguyên liệu" }),
    );

    fireEvent.change(screen.getByLabelText("Tên giá trị"), {
      target: { value: "Bột" },
    });
    fireEvent.change(screen.getByLabelText("Mã SKU"), {
      target: { value: "POWDER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm giá trị" }));

    await waitFor(() =>
      expect(mockedCreateAttributeOption).toHaveBeenCalledWith({
        code: "POWDER",
        key: "MATERIAL_CATEGORY",
        name: "Bột",
      }),
    );
  });
  it("includes the category option with field options when previewing a SKU", async () => {
    const selectWarning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const categoryOption = {
      code: "RAW",
      id: "category-raw",
      isActive: true,
      key: "MATERIAL_CATEGORY" as const,
      name: "Nguyên liệu thô",
      sortOrder: 1,
    };
    const materialTypeOption = {
      code: "BEAN",
      id: "material-bean",
      isActive: true,
      key: "MATERIAL_TYPE" as const,
      name: "Hạt",
      sortOrder: 1,
    };

    mockedGetSkuTemplate.mockImplementation(async (type, categoryOptionId) => {
      if (type === "MATERIAL" && !categoryOptionId) {
        return {
          categoryKey: "MATERIAL_CATEGORY",
          kind: "category-options",
          options: [categoryOption],
        };
      }
      if (type === "MATERIAL" && categoryOptionId === categoryOption.id) {
        return {
          fields: [{ key: "MATERIAL_TYPE" }],
          itemType: "MATERIAL",
          kind: "template",
          prefix: "MAT-RAW",
          templateId: "material-raw-template",
        };
      }
      return {
        fields: [],
        itemType: "CUP_BLANK",
        kind: "template",
        prefix: "CUP",
        templateId: "cup-template",
      };
    });
    mockedListAttributeOptions.mockImplementation(async (key) =>
      key === "MATERIAL_TYPE" ? [materialTypeOption] : [],
    );
    mockedPreviewWarehouseItemSku.mockResolvedValue({
      sku: "MAT-RAW-BEAN",
    });

    renderWithQueryClient(
      <CreateWarehouseItemPanel canManage onCreated={vi.fn()} />,
    );

    fireEvent.click(
      await screen.findByRole("combobox", { name: "Loại mặt hàng" }),
    );
    fireEvent.click(await screen.findByRole("option", { name: "Nguyên liệu" }));
    fireEvent.click(
      await screen.findByRole("combobox", { name: "Nhóm nguyên liệu" }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "Nguyên liệu thô (RAW)" }),
    );
    fireEvent.click(
      await screen.findByRole("combobox", { name: "Loại nguyên liệu" }),
    );
    fireEvent.click(await screen.findByRole("option", { name: "Hạt (BEAN)" }));

    await waitFor(
      () =>
        expect(mockedPreviewWarehouseItemSku).toHaveBeenCalledWith({
          attributeOptionIds: ["category-raw", "material-bean"],
          templateId: "material-raw-template",
          type: "MATERIAL",
        }),
      { timeout: 1500 },
    );
    expect(
      selectWarning.mock.calls.filter(([message]) =>
        String(message).includes("controlled to uncontrolled"),
      ),
    ).toEqual([]);
    expect(
      selectWarning.mock.calls.filter(([message]) =>
        String(message).includes("uncontrolled to controlled"),
      ),
    ).toEqual([]);
    selectWarning.mockRestore();
  });
  it("uses the direct MATERIAL template and omits an unselected optional attribute", async () => {
    const category = {
      code: "RAW",
      id: "category-raw",
      isActive: true,
      key: "MATERIAL_CATEGORY" as const,
      name: "Nguyên liệu thô",
      sortOrder: 1,
    };
    const materialType = {
      code: "BEAN",
      id: "material-bean",
      isActive: true,
      key: "MATERIAL_TYPE" as const,
      name: "Hạt",
      sortOrder: 1,
    };
    const spec = {
      code: "500G",
      id: "spec-500g",
      isActive: true,
      key: "SPEC" as const,
      name: "Túi 500g",
      sortOrder: 1,
    };

    mockedGetSkuTemplate.mockImplementation(async (type) =>
      type === "MATERIAL"
        ? {
            category: null,
            fields: [
              { key: "MATERIAL_CATEGORY", required: true },
              { key: "MATERIAL_TYPE", required: true },
              { key: "FLAVOR", required: false },
              { key: "SPEC", required: true },
            ],
            itemType: "MATERIAL",
            kind: "template",
            templateId: "MATERIAL",
          }
        : {
            fields: [],
            itemType: "CUP_BLANK",
            kind: "template",
            templateId: "CUP_BLANK",
          },
    );
    mockedListAttributeOptions.mockImplementation(async (key) =>
      key === "MATERIAL_CATEGORY"
        ? [category]
        : key === "MATERIAL_TYPE"
          ? [materialType]
          : key === "SPEC"
            ? [spec]
            : [],
    );
    mockedPreviewWarehouseItemSku.mockResolvedValue({ sku: "MAT-RAW-BEAN-500G" });

    renderWithQueryClient(
      <CreateWarehouseItemPanel canManage onCreated={vi.fn()} />,
    );

    fireEvent.click(
      await screen.findByRole("combobox", { name: "Loại mặt hàng" }),
    );
    fireEvent.click(await screen.findByRole("option", { name: "Nguyên liệu" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Nhóm nguyên liệu" }));
    fireEvent.click(await screen.findByRole("option", { name: "Nguyên liệu thô (RAW)" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Loại nguyên liệu" }));
    fireEvent.click(await screen.findByRole("option", { name: "Hạt (BEAN)" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Quy cách tồn" }));
    fireEvent.click(await screen.findByRole("option", { name: "Túi 500g (500G)" }));

    await waitFor(() =>
      expect(mockedPreviewWarehouseItemSku).toHaveBeenCalledWith({
        attributeOptionIds: ["category-raw", "material-bean", "spec-500g"],
        templateId: "MATERIAL",
        type: "MATERIAL",
      }),
    );
    expect(mockedGetSkuTemplate).toHaveBeenCalledWith("MATERIAL");
    expect(mockedGetSkuTemplate).not.toHaveBeenCalledWith(
      "MATERIAL",
      expect.any(String),
    );
  });

  it("provides text search in SKU attribute selectors", async () => {
    mockedGetSkuTemplate.mockResolvedValue({
      fields: [{ key: "MATERIAL", required: true }],
      itemType: "CUP_BLANK",
      kind: "template",
      templateId: "CUP_BLANK",
    });
    mockedListAttributeOptions.mockResolvedValue([
      {
        code: "PET",
        id: "material-pet",
        isActive: true,
        key: "MATERIAL",
        name: "Nhựa PET",
        sortOrder: 1,
      },
      {
        code: "PAPER",
        id: "material-paper",
        isActive: true,
        key: "MATERIAL",
        name: "Giấy",
        sortOrder: 2,
      },
    ]);

    renderWithQueryClient(
      <CreateWarehouseItemPanel canManage onCreated={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("combobox", { name: "Chất liệu" }));
    fireEvent.change(screen.getByPlaceholderText("Tìm tên hoặc mã SKU"), {
      target: { value: "PET" },
    });

    expect(await screen.findByRole("option", { name: "Nhựa PET (PET)" })).toBeVisible();
  });
});

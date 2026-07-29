import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { RackCellViewer } from "@/features/warehouse-navigation/components/rack-cell-viewer";
import type { StorageCellView } from "@/features/warehouse-navigation/services/warehouse-operations.service";

vi.mock("jsbarcode", () => ({
  default: vi.fn((element: SVGSVGElement, value: string) => {
    element.setAttribute("data-barcode-value", value);
  }),
}));

function cell(overrides: Partial<StorageCellView> = {}): StorageCellView {
  return {
    id: "cell-1",
    rackId: "rack-1",
    shelfId: "shelf-1",
    level: 1,
    bay: 1,
    code: "A-01-01",
    barcode: "CELL-A-01-01",
    status: "ACTIVE",
    innerDepth: 100,
    innerWidth: 80,
    innerHeight: 60,
    usableVolumeCm3: 480000,
    occupiedVolumeCm3: 0,
    fillPercent: 0,
    contents: [],
    ...overrides,
  };
}

const packageSpec = {
  depthCm: 30,
  widthCm: 20,
  heightCm: 10,
  volumeCm3: 6000,
};

function ControlledViewer({
  value,
  onActivate = vi.fn(),
}: {
  value: StorageCellView;
  onActivate?: (cell: StorageCellView) => void;
}) {
  const [selected, setSelected] = useState<string>();
  return (
    <RackCellViewer
      rackCode="A-01"
      cells={[value]}
      selectedCellId={selected}
      onSelectCell={(selectedCell) => setSelected(selectedCell.id)}
      onActivateCell={onActivate}
      packageSpec={packageSpec}
      suggestedCellIds={[]}
      operation="PUTAWAY"
    />
  );
}

describe("rack cell viewer", () => {
  it("opens the rack in 2D by default and allows an empty compatible override", () => {
    const onActivate = vi.fn();
    render(<ControlledViewer value={cell()} onActivate={onActivate} />);

    expect(screen.getByRole("button", { name: "2D" })).toBeInTheDocument();
    expect(
      screen.getByText("Kệ 0,8 × 1 × 0,6 m · 1 tầng · 1 khoang"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /A-01-01/i }));
    expect(screen.getAllByText("Trống · có thể cất")).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: /Chọn khoang và quét mã/i }),
    );
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cell-1" }),
    );
  });

  it("keeps a full cell view-only", () => {
    render(
      <ControlledViewer
        value={cell({ occupiedVolumeCm3: 480000, fillPercent: 100 })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /A-01-01/i }));
    expect(screen.getAllByText("Khoang đã đầy")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Khoang chỉ xem" }),
    ).toBeDisabled();
  });

  it("shows the selected shelf barcode for scanner confirmation", () => {
    render(<ControlledViewer value={cell({ barcode: "RACK-03-T1-B1" })} />);

    fireEvent.click(screen.getByRole("button", { name: /A-01-01/i }));

    expect(screen.getByText("Mã vạch khoang")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Mã vạch nội bộ RACK-03-T1-B1" }),
    ).toBeInTheDocument();
  });

  it("shows inventory and capacity for the first occupied cell by default", () => {
    render(
      <RackCellViewer
        rackCode="A-01"
        cells={[
          cell({
            contents: [
              {
                id: "stock-1",
                sku: "SKU-01",
                itemName: "Mặt hàng kiểm thử",
                unit: "thùng",
                quantity: 12,
                lotNumber: "LOT-01",
              },
            ],
            fillPercent: 40,
          }),
        ]}
        onActivateCell={vi.fn()}
        onSelectCell={vi.fn()}
        operation="PUTAWAY"
      />,
    );

    expect(screen.getByText("Mã vạch khoang")).toBeVisible();
    expect(screen.getByText("SKU-01")).toBeVisible();
    expect(screen.getByText("12 thùng")).toBeVisible();
    expect(screen.queryByText(/Chọn một khoang/)).not.toBeInTheDocument();
  });

  it("hides the cell action button in view-only mode", () => {
    render(
      <RackCellViewer
        rackCode="A-01"
        cells={[cell()]}
        onActivateCell={vi.fn()}
        onSelectCell={vi.fn()}
        packageSpec={packageSpec}
        showCellAction={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Chọn khoang và quét mã" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Khoang chỉ xem" }),
    ).not.toBeInTheDocument();
  });

  it("opens lot and item details from a stored batch card", () => {
    render(
      <ControlledViewer
        value={cell({
          fillPercent: 28,
          occupiedVolumeCm3: 120000,
          contents: [
            {
              id: "stock-1",
              sku: "CUP-RND-PP-700-WHT",
              itemName: "Ly nhựa PP 700ml trắng sữa",
              images: ["https://cdn.example/cup.png"],
              unit: "thùng",
              quantity: 10,
              packageFactor: 50,
              packageDepthCm: 30,
              packageWidthCm: 20,
              packageHeightCm: 10,
              packageVolumeCm3Snapshot: 6000,
              lotNumber: "LOT-260715-002",
              expiryDate: "2027-07-15T00:00:00.000Z",
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /A-01-01/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /CUP-RND-PP-700-WHT Ly nhựa PP 700ml trắng sữa/i,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Chi tiết lô LOT-260715-002",
    });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("CUP-RND-PP-700-WHT")).toBeVisible();
    expect(
      within(dialog).getByText("Ly nhựa PP 700ml trắng sữa"),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("img", {
        name: "Ảnh mặt hàng CUP-RND-PP-700-WHT",
      }),
    ).toBeVisible();
    expect(within(dialog).getByText("10 thùng")).toBeVisible();
    expect(within(dialog).getByText("50 đơn vị/thùng")).toBeVisible();
    expect(within(dialog).getByText("30 × 20 × 10 cm")).toBeVisible();
    expect(within(dialog).getByText("15/07/2027")).toBeVisible();
    expect(
      within(dialog).queryByText("2027-07-15T00:00:00.000Z"),
    ).not.toBeInTheDocument();
  });
});

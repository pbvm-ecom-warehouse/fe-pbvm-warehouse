import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { RackCellViewer } from "@/features/warehouse-navigation/components/rack-cell-viewer";
import type { StorageCellView } from "@/features/warehouse-navigation/services/warehouse-operations.service";

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
});

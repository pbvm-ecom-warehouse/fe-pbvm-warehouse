import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  WarehouseArchitectureScene,
  type WarehouseSceneMode,
} from "@/features/warehouse-navigation/components/warehouse-architecture-scene";
import { fallbackWarehouseLayout } from "@/features/warehouse-layout/utils/warehouse-layout";
import {
  fallbackPutawaySuggestions,
  fallbackShelves,
  groupShelvesByRack,
  selectSuggestedShelf,
} from "@/features/warehouse-navigation/utils/putaway-navigation";

function WarehouseSceneHarness() {
  const suggestions = fallbackPutawaySuggestions({
    sku: "CUP-BLANK-500",
    quantity: 80,
  });
  const selectedSuggestion = selectSuggestedShelf(suggestions);
  const [sceneMode, setSceneMode] = useState<WarehouseSceneMode>("map");
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>(
    selectedSuggestion?.shelf.rackCode ?? null,
  );
  const [selectedShelfCode, setSelectedShelfCode] = useState<string | null>(
    selectedSuggestion?.shelf.code ?? null,
  );
  const suggestedShelfCodes = useMemo(
    () => new Set(suggestions.map((suggestion) => suggestion.shelf.code)),
    [suggestions],
  );
  const rackGroup = useMemo(
    () =>
      groupShelvesByRack(fallbackShelves).find(
        (group) => group.rackCode === selectedRackCode,
      ) ?? null,
    [selectedRackCode],
  );

  return (
    <WarehouseArchitectureScene
      contentsByShelf={{
        "A1-S02": [
          {
            id: "stock-1",
            sku: "CUP-BLANK-500",
            itemName: "Ly trắng 500ml",
            quantity: 24,
            unit: "cái",
            containerType: "box",
            placement: {
              x: 8,
              y: 14,
              width: 34,
              height: 32,
              depth: 12,
              label: "LOT-A",
            },
            status: "AVAILABLE",
          },
        ],
      }}
      erroredShelfCodes={new Set()}
      layout={fallbackWarehouseLayout}
      layoutSource="api"
      loadingShelfCodes={new Set()}
      onBackToMap={() => setSceneMode("map")}
      onOpenRack={(rackCode, shelfCode) => {
        setSelectedRackCode(rackCode);
        setSelectedShelfCode(shelfCode);
        setSceneMode("rack");
      }}
      onRetryShelf={vi.fn()}
      onSelectShelf={setSelectedShelfCode}
      rackGroup={rackGroup}
      route={selectedSuggestion?.route ?? null}
      sceneMode={sceneMode}
      selectedRackCode={selectedRackCode}
      selectedShelfCode={selectedShelfCode}
      suggestions={suggestions}
      suggestedShelfCodes={suggestedShelfCodes}
      unsupportedShelfCodes={new Set()}
    />
  );
}

describe("warehouse navigation components", () => {
  it("zooms from the map into a standing rack with API box contents", async () => {
    render(<WarehouseSceneHarness />);

    expect(screen.getByText("GATE-01")).toBeInTheDocument();
    expect(screen.getByText(/GATE-01 → A1-S02/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mở Rack A1/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: /Quay lại sơ đồ/i }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Mở Rack A1/i }));

    expect(
      await screen.findByRole("heading", { name: /Rack A1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Quay lại sơ đồ/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("LOT-A")).toBeInTheDocument();
    expect(screen.getByText("CUP-BLANK-500")).toBeInTheDocument();
    expect(screen.getByText("24 cái")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Quay lại sơ đồ/i }),
    );

    expect(
      await screen.findByRole("button", { name: /Mở Rack A1/i }),
    ).toBeInTheDocument();
  });
});

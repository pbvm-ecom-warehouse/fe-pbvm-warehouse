import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/warehouse-layout/components/warehouse-map-client", () => ({
  WarehouseMapClient: () => <div>Warehouse editor canonical</div>,
}));

import LocationsPage from "@/app/(dashboard)/locations/page";
import LocationsMapPage from "@/app/(dashboard)/locations/map/page";

describe("warehouse location routes", () => {
  it("render editor trực tiếp tại /locations", () => {
    render(<LocationsPage />);

    expect(screen.getByText("Warehouse editor canonical")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirect route /locations/map cũ về /locations", () => {
    LocationsMapPage();

    expect(redirect).toHaveBeenCalledWith("/locations");
  });
});

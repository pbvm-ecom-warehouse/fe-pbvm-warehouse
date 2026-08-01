import type {
  WarehouseLayoutZone,
  WarehouseZoneAllowedItemType,
  WarehouseZonePurpose,
} from "@/types/api";

export const zoneItemTypes: Array<{
  value: WarehouseZoneAllowedItemType;
  label: string;
}> = [
  { value: "MATERIAL", label: "Nguyên liệu" },
  { value: "CUP_BLANK", label: "Ly trơn" },
  { value: "CUP_PRINTED", label: "Ly đã in" },
  { value: "PACKAGING", label: "Bao bì" },
];

const allowedItemTypeValues = new Set(
  zoneItemTypes.map((itemType) => itemType.value),
);

export type NormalizedZonePolicy = {
  zonePurpose: WarehouseZonePurpose;
  allowedItemTypes: WarehouseZoneAllowedItemType[];
};

export function getZonePolicy(
  zone: Pick<WarehouseLayoutZone, "zonePurpose" | "allowedItemTypes">,
): NormalizedZonePolicy {
  const zonePurpose = zone.zonePurpose === "SCRAP" ? "SCRAP" : "STORAGE";
  if (zonePurpose === "SCRAP") {
    return { zonePurpose, allowedItemTypes: [] };
  }

  return {
    zonePurpose,
    allowedItemTypes: (zone.allowedItemTypes ?? []).filter((itemType) =>
      allowedItemTypeValues.has(itemType),
    ),
  };
}

export function normalizeZonePolicy(
  zone: WarehouseLayoutZone,
): WarehouseLayoutZone & NormalizedZonePolicy {
  return { ...zone, ...getZonePolicy(zone) };
}

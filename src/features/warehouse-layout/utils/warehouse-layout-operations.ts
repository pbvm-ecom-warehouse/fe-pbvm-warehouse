import type {
  SaveWarehouseLayoutRequest,
  WarehouseLayoutOperation,
} from "../services/warehouse-layout.service";
import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutGate,
  WarehouseLayoutRack,
  WarehouseLayoutShelf,
  WarehouseLayoutZone,
} from "@/types/api";

function isTemporaryId(id: string) {
  return id.startsWith("tmp:");
}

function compact(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return compact(
    Object.fromEntries(
      Object.keys(after)
        .filter((key) => !Object.is(before[key], after[key]))
        .map((key) => [key, after[key]]),
    ),
  );
}

function zoneData(zone: WarehouseLayoutZone) {
  return {
    code: zone.code,
    name: zone.name,
    xM: zone.xM,
    yM: zone.yM,
    widthM: zone.widthM,
    heightM: zone.heightM,
    rotation: zone.rotation,
  };
}

function rackData(rack: WarehouseLayoutRack) {
  return {
    zoneId: rack.zoneId,
    code: rack.code,
    name: rack.name,
    xM: rack.xM,
    yM: rack.yM,
    rotation: rack.rotation,
    accessPointXM: rack.accessPoint.xM,
    accessPointYM: rack.accessPoint.yM,
  };
}

function shelfData(shelf: WarehouseLayoutShelf) {
  return compact({
    rackId: shelf.rackId,
    level: shelf.level,
    code: shelf.code,
    innerDepth: shelf.innerDepth,
    innerWidth: shelf.innerWidth,
    innerHeight: shelf.innerHeight,
    fillFactor: shelf.fillFactor,
    isStaging: shelf.isStaging,
  });
}

function aisleData(aisle: WarehouseLayoutAisle) {
  return {
    code: aisle.code,
    type: aisle.type,
    xM: aisle.xM,
    yM: aisle.yM,
    widthM: aisle.widthM,
    heightM: aisle.heightM,
  };
}

function gateData(gate: WarehouseLayoutGate) {
  return {
    code: gate.code,
    label: gate.label,
    xM: gate.xM,
    yM: gate.yM,
  };
}

function createOperations<T extends { id: string }>(
  items: T[],
  entity: "ZONE" | "RACK" | "SHELF" | "AISLE" | "GATE",
  serialize: (item: T) => Record<string, unknown>,
): WarehouseLayoutOperation[] {
  return items
    .filter((item) => isTemporaryId(item.id))
    .map((item) => ({
      op: "CREATE" as const,
      entity,
      clientId: item.id,
      data: serialize(item),
    }));
}

function updateOperations<T extends { id: string }>(
  beforeItems: T[],
  afterItems: T[],
  entity: "ZONE" | "RACK" | "SHELF" | "AISLE" | "GATE",
  serialize: (item: T) => Record<string, unknown>,
): WarehouseLayoutOperation[] {
  const afterById = new Map(afterItems.map((item) => [item.id, item]));

  return beforeItems.flatMap((before) => {
    const after = afterById.get(before.id);
    if (!after) return [];
    const patch = changedFields(serialize(before), serialize(after));
    return Object.keys(patch).length > 0
      ? [{ op: "UPDATE" as const, entity, id: before.id, patch }]
      : [];
  });
}

function deleteOperations<T extends { id: string }>(
  beforeItems: T[],
  afterItems: T[],
  entity: "ZONE" | "RACK" | "SHELF" | "AISLE" | "GATE",
): WarehouseLayoutOperation[] {
  const remainingIds = new Set(afterItems.map((item) => item.id));
  return beforeItems
    .filter((item) => !remainingIds.has(item.id))
    .map((item) => ({ op: "DELETE" as const, entity, id: item.id }));
}

export function buildWarehouseLayoutOperations(
  base: WarehouseLayout,
  draft: WarehouseLayout,
): WarehouseLayoutOperation[] {
  const operations: WarehouseLayoutOperation[] = [];
  const canvasPatch = changedFields(base.canvas, draft.canvas);
  if (Object.keys(canvasPatch).length > 0) {
    operations.push({ op: "UPDATE", entity: "CANVAS", patch: canvasPatch });
  }

  const baseTemplate = base.rackTemplate;
  const draftTemplate = draft.rackTemplate;
  const templatePatch = changedFields(baseTemplate, draftTemplate);
  if (Object.keys(templatePatch).length > 0) {
    operations.push({
      op: "UPDATE",
      entity: "RACK_TEMPLATE",
      patch: templatePatch,
    });
  }

  const baseShelves = base.shelves;
  const draftShelves = draft.shelves;

  operations.push(
    ...deleteOperations(baseShelves, draftShelves, "SHELF"),
    ...deleteOperations(base.racks, draft.racks, "RACK"),
    ...deleteOperations(base.zones, draft.zones, "ZONE"),
    ...deleteOperations(base.aisles, draft.aisles, "AISLE"),
    ...deleteOperations(base.gates, draft.gates, "GATE"),
    ...createOperations(draft.zones, "ZONE", zoneData),
    ...createOperations(draft.racks, "RACK", rackData),
    ...createOperations(draftShelves, "SHELF", shelfData),
    ...createOperations(draft.aisles, "AISLE", aisleData),
    ...createOperations(draft.gates, "GATE", gateData),
    ...updateOperations(base.zones, draft.zones, "ZONE", zoneData),
    ...updateOperations(base.racks, draft.racks, "RACK", rackData),
    ...updateOperations(baseShelves, draftShelves, "SHELF", shelfData),
    ...updateOperations(base.aisles, draft.aisles, "AISLE", aisleData),
    ...updateOperations(base.gates, draft.gates, "GATE", gateData),
  );

  return operations;
}

export function buildSaveWarehouseLayoutRequest(
  base: WarehouseLayout,
  draft: WarehouseLayout,
): SaveWarehouseLayoutRequest {
  return {
    expectedRevision: base.revision,
    operations: buildWarehouseLayoutOperations(base, draft),
  };
}

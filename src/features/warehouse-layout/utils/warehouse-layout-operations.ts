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

/**
 * Đồng bộ số tầng vật lý với rack template. Tầng mới nhận kích thước usable
 * theo template để backend có thể sinh khoang và tính gợi ý ngay sau khi lưu.
 */
export function reconcileRackShelves(
  layout: WarehouseLayout,
  createId: () => string = () => `tmp:${crypto.randomUUID()}`,
): WarehouseLayout {
  const template = layout.rackTemplate;
  const totalHeightM =
    Number.isFinite(template.heightM) && template.heightM > 0
      ? template.heightM
      : template.levelCount;
  const innerHeight = (totalHeightM * 100) / template.levelCount;
  const shelves: WarehouseLayoutShelf[] = [];
  const racks = layout.racks.map((rack) => {
    const current = layout.shelves
      .filter((shelf) => shelf.rackId === rack.id)
      .sort((left, right) => left.level - right.level);
    const isStagingRack =
      current.length > 0 && current.every((shelf) => shelf.isStaging);
    const byLevel = new Map(current.map((shelf) => [shelf.level, shelf]));
    const rackShelves = Array.from(
      { length: template.levelCount },
      (_, index) => {
        const level = index + 1;
        const existing = byLevel.get(level);
        if (existing) {
          return {
            ...existing,
            innerDepth: template.depthM * 100,
            innerWidth: template.widthM * 100,
            innerHeight,
          };
        }
        return {
          id: createId(),
          rackId: rack.id,
          level,
          code: `${rack.code}-T${level}`,
          innerDepth: template.depthM * 100,
          innerWidth: template.widthM * 100,
          innerHeight,
          isStaging: isStagingRack,
        };
      },
    );
    shelves.push(...rackShelves);
    return {
      ...rack,
      widthM: template.widthM,
      depthM: template.depthM,
      levelCount: template.levelCount,
      bayCount: template.bayCount,
      shelfCodes: rackShelves.map((shelf) => shelf.code),
    };
  });

  return { ...layout, racks, shelves };
}

/**
 * Chọn nhận tạm theo rack, không theo một tầng rời rạc. Mọi tầng của rack
 * nhận tạm được loại khỏi kho lưu trữ; mọi rack còn lại luôn trở về storage.
 */
export function setStagingRack(
  layout: WarehouseLayout,
  rackId: string | null,
): WarehouseLayout {
  return {
    ...layout,
    shelves: layout.shelves.map((shelf) => ({
      ...shelf,
      isStaging: rackId !== null && shelf.rackId === rackId,
    })),
  };
}

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

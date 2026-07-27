import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutCanvas,
  WarehouseLayoutGate,
  WarehouseLayoutRack,
  WarehouseLayoutRotation,
  WarehouseLayoutShelf,
  WarehouseLayoutZone,
  WarehouseRackTemplate,
} from "@/types/api";

export type WarehouseLayoutEntity =
  | "CANVAS"
  | "RACK_TEMPLATE"
  | "ZONE"
  | "RACK"
  | "SHELF"
  | "AISLE"
  | "GATE";

export type WarehouseLayoutOperation =
  | {
      op: "CREATE";
      entity: Exclude<WarehouseLayoutEntity, "CANVAS" | "RACK_TEMPLATE">;
      clientId: string;
      data: Record<string, unknown>;
    }
  | {
      op: "UPDATE";
      entity: WarehouseLayoutEntity;
      id?: string;
      patch: Record<string, unknown>;
    }
  | {
      op: "DELETE";
      entity: Exclude<WarehouseLayoutEntity, "CANVAS" | "RACK_TEMPLATE">;
      id: string;
    };

export type SaveWarehouseLayoutRequest = {
  expectedRevision: number;
  operations: WarehouseLayoutOperation[];
};

export type SaveWarehouseLayoutResponse = {
  revision: number;
  idMap: Record<string, string>;
  layout: WarehouseLayout;
};

type RackPositionApiRow = {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  xM: number;
  yM: number;
  rotation: number;
  accessPointXM: number;
  accessPointYM: number;
};

type WarehouseLayoutApiResponse = {
  id: "single-warehouse-layout";
  revision: number;
  updatedAt: string;
  canvas: WarehouseLayoutCanvas;
  rackTemplate: WarehouseRackTemplate;
  zones: WarehouseLayoutZone[];
  racks: RackPositionApiRow[];
  shelves: WarehouseLayoutShelf[];
  aisles: WarehouseLayoutAisle[];
  gates: WarehouseLayoutGate[];
};

export class WarehouseLayoutContractError extends Error {
  readonly code = "WAREHOUSE_LAYOUT_API_OUTDATED";

  constructor(readonly missingFields: string[]) {
    super(
      `Warehouse layout API thiếu các field bắt buộc: ${missingFields.join(", ")}.`,
    );
    this.name = "WarehouseLayoutContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertWarehouseLayoutApiResponse(
  value: unknown,
): asserts value is WarehouseLayoutApiResponse {
  const missingFields: string[] = [];

  if (!isRecord(value)) {
    throw new WarehouseLayoutContractError([
      "id",
      "updatedAt",
      "canvas",
      "revision",
      "shelves",
      "rackTemplate",
      "zones",
      "racks",
      "aisles",
      "gates",
    ]);
  }

  if (value.id !== "single-warehouse-layout") missingFields.push("id");
  if (typeof value.updatedAt !== "string" || value.updatedAt.length === 0) {
    missingFields.push("updatedAt");
  }
  if (!isRecord(value.canvas)) {
    missingFields.push("canvas");
  } else {
    if (
      typeof value.canvas.widthM !== "number" ||
      !Number.isFinite(value.canvas.widthM) ||
      value.canvas.widthM <= 0
    ) {
      missingFields.push("canvas.widthM");
    }
    if (
      typeof value.canvas.heightM !== "number" ||
      !Number.isFinite(value.canvas.heightM) ||
      value.canvas.heightM <= 0
    ) {
      missingFields.push("canvas.heightM");
    }
    if (
      typeof value.canvas.gridM !== "number" ||
      !Number.isFinite(value.canvas.gridM) ||
      value.canvas.gridM <= 0
    ) {
      missingFields.push("canvas.gridM");
    }
  }
  if (typeof value.revision !== "number") missingFields.push("revision");
  if (!Array.isArray(value.shelves)) missingFields.push("shelves");
  if (!isRecord(value.rackTemplate)) missingFields.push("rackTemplate");
  if (!Array.isArray(value.zones)) missingFields.push("zones");
  if (!Array.isArray(value.racks)) missingFields.push("racks");
  if (!Array.isArray(value.aisles)) missingFields.push("aisles");
  if (!Array.isArray(value.gates)) missingFields.push("gates");

  if (missingFields.length > 0) {
    throw new WarehouseLayoutContractError(missingFields);
  }
}

type SaveWarehouseLayoutApiResponse = Omit<
  SaveWarehouseLayoutResponse,
  "layout"
> & {
  layout: WarehouseLayoutApiResponse;
};

function toLayoutRack(
  rack: RackPositionApiRow,
  template: WarehouseRackTemplate,
  shelves: WarehouseLayoutShelf[],
): WarehouseLayoutRack {
  return {
    id: rack.id,
    zoneId: rack.zoneId,
    code: rack.code,
    name: rack.name,
    xM: rack.xM,
    yM: rack.yM,
    widthM: template.widthM,
    depthM: template.depthM,
    rotation: rack.rotation as WarehouseLayoutRotation,
    levelCount: template.levelCount,
    bayCount: template.bayCount,
    shelfCodes: shelves
      .filter((shelf) => shelf.rackId === rack.id)
      .sort((left, right) => left.level - right.level)
      .map((shelf) => shelf.code),
    accessPoint: { xM: rack.accessPointXM, yM: rack.accessPointYM },
  };
}

export function mapWarehouseLayoutResponse(data: unknown): WarehouseLayout {
  assertWarehouseLayoutApiResponse(data);
  const shelves = data.shelves;

  return {
    id: data.id,
    revision: data.revision,
    updatedAt: data.updatedAt,
    status: "PUBLISHED",
    canvas: data.canvas,
    rackTemplate: data.rackTemplate,
    zones: data.zones,
    racks: data.racks.map((rack) =>
      toLayoutRack(rack, data.rackTemplate, shelves),
    ),
    shelves,
    aisles: data.aisles,
    gates: data.gates,
  };
}

export async function fetchWarehouseLayout(): Promise<WarehouseLayout> {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseLayoutApiResponse> | WarehouseLayoutApiResponse
  >("/location/layout");

  return mapWarehouseLayoutResponse(unwrapApiData(response.data));
}

export async function saveWarehouseLayout(
  request: SaveWarehouseLayoutRequest,
): Promise<SaveWarehouseLayoutResponse> {
  const response = await apiClient.patch<
    ApiEnvelope<SaveWarehouseLayoutApiResponse> | SaveWarehouseLayoutApiResponse
  >("/location/layout", request);
  const data = unwrapApiData(response.data);

  return {
    revision: data.revision,
    idMap: data.idMap,
    layout: mapWarehouseLayoutResponse(data.layout),
  };
}

export async function resetWarehouseLayout(): Promise<WarehouseLayout> {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseLayoutApiResponse> | WarehouseLayoutApiResponse
  >("/location/layout/reset");

  return mapWarehouseLayoutResponse(unwrapApiData(response.data));
}

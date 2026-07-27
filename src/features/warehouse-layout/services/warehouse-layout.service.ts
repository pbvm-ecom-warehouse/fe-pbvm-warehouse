import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutGate,
  WarehouseLayoutRack,
  WarehouseLayoutZone,
} from "@/types/api";

const CANVAS_PADDING_M = 2;
const CANVAS_GRID_M = 0.5;

export type RackTemplate = {
  widthM: number;
  depthM: number;
  levelCount: number;
  bayCount: number;
};

type RackPositionApiRow = {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  xM: number;
  yM: number;
  rotation: 0 | 90;
  accessPointXM: number;
  accessPointYM: number;
};

type LayoutApiResponse = {
  zones: WarehouseLayoutZone[];
  racks: RackPositionApiRow[];
  aisles: WarehouseLayoutAisle[];
  gates: WarehouseLayoutGate[];
  rackTemplate: RackTemplate;
};

function buildCanvas(zones: WarehouseLayoutZone[]) {
  if (zones.length === 0) {
    return { widthM: 40, heightM: 24, gridM: CANVAS_GRID_M };
  }

  const maxX = Math.max(...zones.map((zone) => zone.xM + zone.widthM));
  const maxY = Math.max(...zones.map((zone) => zone.yM + zone.heightM));

  return {
    widthM: maxX + CANVAS_PADDING_M,
    heightM: maxY + CANVAS_PADDING_M,
    gridM: CANVAS_GRID_M,
  };
}

function toLayoutRack(
  rack: RackPositionApiRow,
  template: RackTemplate,
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
    rotation: rack.rotation,
    levelCount: template.levelCount,
    bayCount: template.bayCount,
    shelfCodes: [],
    accessPoint: { xM: rack.accessPointXM, yM: rack.accessPointYM },
  };
}

export async function fetchWarehouseLayout(): Promise<WarehouseLayout> {
  const response = await apiClient.get<
    ApiEnvelope<LayoutApiResponse> | LayoutApiResponse
  >("/location/layout");
  const data = unwrapApiData(response.data);

  return {
    id: "single-warehouse-layout",
    revision: 1,
    status: "PUBLISHED",
    canvas: buildCanvas(data.zones),
    zones: data.zones,
    racks: data.racks.map((rack) => toLayoutRack(rack, data.rackTemplate)),
    aisles: data.aisles,
    gates: data.gates,
  };
}

export async function patchZone(
  zoneId: string,
  patch: Record<string, unknown>,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseLayoutZone> | WarehouseLayoutZone
  >(`/location/zones/${encodeURIComponent(zoneId)}`, patch);
  return unwrapApiData(response.data);
}

export async function patchRack(
  rackId: string,
  patch: Record<string, unknown>,
) {
  const response = await apiClient.patch<
    ApiEnvelope<RackPositionApiRow> | RackPositionApiRow
  >(`/location/racks/${encodeURIComponent(rackId)}`, patch);
  return unwrapApiData(response.data);
}

export async function patchAisle(
  aisleId: string,
  patch: Record<string, unknown>,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseLayoutAisle> | WarehouseLayoutAisle
  >(`/location/aisles/${encodeURIComponent(aisleId)}`, patch);
  return unwrapApiData(response.data);
}

export async function patchGate(
  gateId: string,
  patch: Record<string, unknown>,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseLayoutGate> | WarehouseLayoutGate
  >(`/location/gates/${encodeURIComponent(gateId)}`, patch);
  return unwrapApiData(response.data);
}

export async function fetchRackTemplate(): Promise<RackTemplate> {
  const response = await apiClient.get<
    ApiEnvelope<RackTemplate> | RackTemplate
  >("/location/rack-template");
  return unwrapApiData(response.data);
}

export async function updateRackTemplate(
  patch: RackTemplate,
): Promise<RackTemplate> {
  const response = await apiClient.put<
    ApiEnvelope<RackTemplate> | RackTemplate
  >("/location/rack-template", patch);
  return unwrapApiData(response.data);
}

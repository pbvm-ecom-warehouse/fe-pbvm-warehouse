import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export type WarehouseStructureZone = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseStructureRack = {
  id: string;
  zoneId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseStructureShelf = {
  id: string;
  rackId: string;
  level: number;
  code: string;
  innerDepth?: number;
  innerWidth?: number;
  innerHeight?: number;
  fillFactor?: number | null;
  isStaging: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateZoneInput = {
  name: string;
  code: string;
};

export type UpdateZoneInput = Partial<CreateZoneInput>;

export type CreateRackInput = {
  zoneId: string;
  name: string;
  code: string;
};

export type UpdateRackInput = Partial<CreateRackInput>;

export type CreateShelfInput = {
  rackId: string;
  level: number;
  code: string;
  innerDepth?: number;
  innerWidth?: number;
  innerHeight?: number;
  fillFactor?: number;
  isStaging?: boolean;
};

export type UpdateShelfInput = Partial<CreateShelfInput>;

export async function listZones() {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureZone[]> | WarehouseStructureZone[]
  >("/location/zones");
  return unwrapApiData(response.data);
}

export async function getZone(zoneId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureZone> | WarehouseStructureZone
  >(`/location/zones/${encodeURIComponent(zoneId)}`);
  return unwrapApiData(response.data);
}

export async function createZone(input: CreateZoneInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureZone> | WarehouseStructureZone
  >("/location/zones", input);
  return unwrapApiData(response.data);
}

export async function updateZone(zoneId: string, input: UpdateZoneInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureZone> | WarehouseStructureZone
  >(`/location/zones/${encodeURIComponent(zoneId)}`, input);
  return unwrapApiData(response.data);
}

export async function deleteZone(zoneId: string) {
  await apiClient.delete(`/location/zones/${encodeURIComponent(zoneId)}`);
}

export async function listRacks(zoneId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureRack[]> | WarehouseStructureRack[]
  >("/location/racks", { params: { zoneId } });
  return unwrapApiData(response.data);
}

export async function getRack(rackId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureRack> | WarehouseStructureRack
  >(`/location/racks/${encodeURIComponent(rackId)}`);
  return unwrapApiData(response.data);
}

export async function createRack(input: CreateRackInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureRack> | WarehouseStructureRack
  >("/location/racks", input);
  return unwrapApiData(response.data);
}

export async function updateRack(rackId: string, input: UpdateRackInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureRack> | WarehouseStructureRack
  >(`/location/racks/${encodeURIComponent(rackId)}`, input);
  return unwrapApiData(response.data);
}

export async function deleteRack(rackId: string) {
  await apiClient.delete(`/location/racks/${encodeURIComponent(rackId)}`);
}

export async function listShelves(rackId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureShelf[]> | WarehouseStructureShelf[]
  >("/location/shelves", { params: { rackId } });
  return unwrapApiData(response.data);
}

export async function getShelf(shelfId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureShelf> | WarehouseStructureShelf
  >(`/location/shelves/${encodeURIComponent(shelfId)}`);
  return unwrapApiData(response.data);
}

export async function createShelf(input: CreateShelfInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureShelf> | WarehouseStructureShelf
  >("/location/shelves", input);
  return unwrapApiData(response.data);
}

export async function updateShelf(shelfId: string, input: UpdateShelfInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureShelf> | WarehouseStructureShelf
  >(`/location/shelves/${encodeURIComponent(shelfId)}`, input);
  return unwrapApiData(response.data);
}

export async function deleteShelf(shelfId: string) {
  await apiClient.delete(`/location/shelves/${encodeURIComponent(shelfId)}`);
}

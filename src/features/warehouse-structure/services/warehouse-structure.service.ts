import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export type WarehouseStructureWarehouse = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseStructureZone = {
  id: string;
  warehouseId: string;
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

export type CreateWarehouseInput = {
  name: string;
  address: string;
  isActive?: boolean;
};

export type UpdateWarehouseInput = Partial<CreateWarehouseInput>;

export type CreateZoneInput = {
  warehouseId: string;
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

export async function listWarehouses() {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureWarehouse[]> | WarehouseStructureWarehouse[]
  >("/warehouse");

  return unwrapApiData(response.data);
}

export async function createWarehouse(input: CreateWarehouseInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureWarehouse> | WarehouseStructureWarehouse
  >("/warehouse", input);

  return unwrapApiData(response.data);
}

export async function updateWarehouse(
  warehouseId: string,
  input: UpdateWarehouseInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureWarehouse> | WarehouseStructureWarehouse
  >(`/warehouse/${encodeURIComponent(warehouseId)}`, input);

  return unwrapApiData(response.data);
}

export async function deleteWarehouse(warehouseId: string) {
  await apiClient.delete(`/warehouse/${encodeURIComponent(warehouseId)}`);
}

export async function listZones(warehouseId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureZone[]> | WarehouseStructureZone[]
  >("/warehouse/zones", {
    params: { warehouseId },
  });

  return unwrapApiData(response.data);
}

export async function createZone(input: CreateZoneInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureZone> | WarehouseStructureZone
  >("/warehouse/zones", input);

  return unwrapApiData(response.data);
}

export async function updateZone(zoneId: string, input: UpdateZoneInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureZone> | WarehouseStructureZone
  >(`/warehouse/zones/${encodeURIComponent(zoneId)}`, input);

  return unwrapApiData(response.data);
}

export async function deleteZone(zoneId: string) {
  await apiClient.delete(`/warehouse/zones/${encodeURIComponent(zoneId)}`);
}

export async function listRacks(zoneId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureRack[]> | WarehouseStructureRack[]
  >("/warehouse/racks", {
    params: { zoneId },
  });

  return unwrapApiData(response.data);
}

export async function createRack(input: CreateRackInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureRack> | WarehouseStructureRack
  >("/warehouse/racks", input);

  return unwrapApiData(response.data);
}

export async function updateRack(rackId: string, input: UpdateRackInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureRack> | WarehouseStructureRack
  >(`/warehouse/racks/${encodeURIComponent(rackId)}`, input);

  return unwrapApiData(response.data);
}

export async function deleteRack(rackId: string) {
  await apiClient.delete(`/warehouse/racks/${encodeURIComponent(rackId)}`);
}

export async function listShelves(rackId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseStructureShelf[]> | WarehouseStructureShelf[]
  >("/warehouse/shelves", {
    params: { rackId },
  });

  return unwrapApiData(response.data);
}

export async function createShelf(input: CreateShelfInput) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseStructureShelf> | WarehouseStructureShelf
  >("/warehouse/shelves", input);

  return unwrapApiData(response.data);
}

export async function updateShelf(shelfId: string, input: UpdateShelfInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseStructureShelf> | WarehouseStructureShelf
  >(`/warehouse/shelves/${encodeURIComponent(shelfId)}`, input);

  return unwrapApiData(response.data);
}

export async function deleteShelf(shelfId: string) {
  await apiClient.delete(`/warehouse/shelves/${encodeURIComponent(shelfId)}`);
}

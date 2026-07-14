import { MissingBackendEndpointError } from "@/lib/api-contract";

function missingInventoryEndpoint(endpoint: string): never {
  throw new MissingBackendEndpointError({ endpoint });
}

export async function listStockLedger() {
  return missingInventoryEndpoint("GET /api/wms/inventory/ledger");
}

export async function listStockMovements() {
  return missingInventoryEndpoint("GET /api/wms/inventory/movements");
}

export async function listInventoryValueSeries() {
  return missingInventoryEndpoint("GET /api/wms/reports/inventory-value-series");
}

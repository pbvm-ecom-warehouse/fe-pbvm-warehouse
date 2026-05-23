export type TenantScoped = {
  tenantId: string;
};

export type WarehouseType = "CENTRAL" | "BRANCH";

export type MoveType =
  | "INBOUND"
  | "OUTBOUND"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUST_PLUS"
  | "ADJUST_MINUS"
  | "CONVERT_OUT"
  | "CONVERT_IN";

export type TransferStatus = "PENDING" | "IN_TRANSIT" | "COMPLETED";

export type Warehouse = TenantScoped & {
  id: string;
  name: string;
  type: WarehouseType;
  address: string;
  isActive: boolean;
};

export type Product = TenantScoped & {
  id: string;
  sku: string;
  name: string;
  category: "ingredient" | "plain_cup" | "printed_cup";
  unit: string;
  isPrintedCup: boolean;
};

export type StockLedgerRow = {
  id: string;
  warehouseName: string;
  productSku: string;
  productName: string;
  quantity: number;
  reservedQty: number;
  reorderPoint: number;
};

export type StockMovement = {
  id: string;
  warehouseName: string;
  productName: string;
  moveType: MoveType;
  quantity: number;
  refId: string;
  refType: string;
  createdAt: string;
};

export type InventoryValuePoint = {
  name: string;
  ingredients: number;
  cups: number;
};

export type ApiListResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

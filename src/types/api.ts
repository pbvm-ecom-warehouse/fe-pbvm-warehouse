export type TenantScoped = {
  tenantId: string;
};

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
};

export type WmsUserStatus = "ACTIVE" | "LOCKED";

export type ListWmsUsersQuery = {
  role?: string;
  search?: string;
  status?: WmsUserStatus;
};

export type WmsUserResponse = {
  id: string;
  avatarUrl?: string;
  username: string;
  email?: string;
  phone?: string;
  name?: string;
  role: string;
  roles?: string[];
  status: WmsUserStatus;
  mustChangePassword: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  success: boolean;
  mustChangePassword: boolean;
};

export type CreateUserInput = {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
};

export type CreateUserResponse = {
  id: string;
  username: string;
  email?: string;
  role: string;
  mustChangePassword: boolean;
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  phone?: string;
};

export type UpdateUserRoleInput = {
  role: string;
};

export type ResetUserPasswordInput = {
  temporaryPassword: string;
};

export type ResetUserPasswordResponse = {
  success: boolean;
  mustChangePassword: boolean;
};

export type WmsHealthResponse = {
  status: "ok" | "error" | string;
  db?: "up" | "down" | string;
  redis?: "up" | "down" | string;
  [key: string]: unknown;
};

export type WmsRootResponse =
  | string
  | {
      message?: string;
      [key: string]: unknown;
    };

export type WarehouseType = "CENTRAL" | "BRANCH";

export type MoveType =
  | "RECEIVE"
  | "PUTAWAY"
  | "ISSUE"
  | "ADJUST"
  | "SCRAP"
  | "PRINT_CONSUME"
  | "PRINT_OUTPUT"
  | "RETURN_IN";

export type Warehouse = TenantScoped & {
  id: string;
  name: string;
  type: WarehouseType;
  address: string;
  isActive: boolean;
};

export type WarehouseLayoutStatus = "DRAFT" | "PUBLISHED";
export type WarehouseLayoutRotation = 0 | 90;

export type WarehouseLayoutCanvas = {
  widthM: number;
  heightM: number;
  gridM: number;
};

export type WarehouseLayoutZone = {
  id: string;
  code: string;
  name: string;
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
  rotation: WarehouseLayoutRotation;
};

export type WarehouseLayoutRack = {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  xM: number;
  yM: number;
  widthM: number;
  depthM: number;
  rotation: WarehouseLayoutRotation;
  levelCount: number;
  bayCount: number;
  shelfCodes: string[];
  accessPoint: { xM: number; yM: number };
};

export type WarehouseLayoutAisle = {
  id: string;
  code: string;
  type: "MAIN" | "RACK";
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
};

export type WarehouseLayoutGate = {
  id: string;
  code: string;
  label: string;
  xM: number;
  yM: number;
};

export type WarehouseLayout = {
  id?: string;
  revision: number;
  status: WarehouseLayoutStatus;
  canvas: WarehouseLayoutCanvas;
  zones: WarehouseLayoutZone[];
  racks: WarehouseLayoutRack[];
  aisles: WarehouseLayoutAisle[];
  gates: WarehouseLayoutGate[];
  updatedAt?: string;
};

export type WarehouseShelf = {
  id: string;
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  rackName: string;
  level: number;
  code: string;
  barcode: string;
  x: number;
  y: number;
  width: number;
  height: number;
  innerDepth?: number;
  innerWidth?: number;
  innerHeight?: number;
  fillFactor?: number;
  isStaging?: boolean;
};

export type WarehouseRoutePoint = {
  code: string;
  label: string;
  x: number;
  y: number;
};

export type WarehouseRoute = {
  from: WarehouseRoutePoint;
  to: WarehouseRoutePoint;
  waypoints: WarehouseRoutePoint[];
  distanceMeters?: number;
  estimatedSeconds?: number;
  instructions?: string[];
};

export type PutawaySuggestion = {
  shelf: WarehouseShelf;
  capacity: number;
  reason: string;
  advisory: boolean;
  pathLabel: string;
  route?: WarehouseRoute;
};

export type ShelfContentPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  depth?: number;
  rotationDeg?: number;
  label?: string;
};

export type ShelfContentDimensions = {
  widthCm?: number;
  depthCm?: number;
  heightCm?: number;
};

export type ShelfContentItem = {
  id: string;
  sku: string;
  itemName: string;
  quantity: number;
  unit: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  barcode?: string;
  containerType?: "box" | "crate" | "pallet" | "bag";
  dimensions?: ShelfContentDimensions | null;
  placement?: ShelfContentPlacement | null;
  status?: "AVAILABLE" | "RESERVED" | "EXPIRED";
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
  productSku: string;
  productName: string;
  quantity: number;
  reserved?: number;
  reservedQty?: number;
  reorderPoint: number;
};

export type StockMovement = {
  id: string;
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
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages?: number;
    };
  };
};

export const WMS_ROLES = [
  "ADMIN",
  "MANAGER",
  "RECEIVER",
  "PICKER",
  "PRINTER",
  "COUNTER",
] as const;

export type WmsRole = (typeof WMS_ROLES)[number];

export const ROLE_LABELS: Record<WmsRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  RECEIVER: "Receiver",
  PICKER: "Picker",
  PRINTER: "Printer",
  COUNTER: "Counter",
};

export const ROLE_DESCRIPTIONS: Record<WmsRole, string> = {
  ADMIN: "Toàn quyền vận hành WMS",
  MANAGER: "Điều phối, tạo lệnh và duyệt",
  RECEIVER: "Nhận hàng, cất hàng và hoàn hàng",
  PICKER: "Soạn hàng, xuất kho và lấy đúng vị trí kệ",
  PRINTER: "Vận hành in ly và xác nhận thành phẩm",
  COUNTER: "Kiểm đếm và ghi nhận chênh lệch",
};

export const ROLE_PRIORITY: readonly WmsRole[] = [
  "ADMIN",
  "MANAGER",
  "RECEIVER",
  "PICKER",
  "PRINTER",
  "COUNTER",
];

const WMS_ROLE_SET = new Set<string>(WMS_ROLES);

const LEGACY_ROLE_MAP: Record<string, readonly WmsRole[]> = {
  owner: ["ADMIN"],
  admin: ["ADMIN"],
  warehouse_manager: ["MANAGER"],
  manager: ["MANAGER"],
  operator: ["RECEIVER", "PICKER"],
  staff: ["RECEIVER", "PICKER"],
};

const ALL_STAFF_ROLES = WMS_ROLES;
const RETIRED_ROUTES = new Set<string>(["/transfers"]);

export const ROUTE_ACCESS_BY_HREF = {
  "/dashboard": ALL_STAFF_ROLES,
  "/warehouses": ["MANAGER"],
  "/products": ["ADMIN", "MANAGER", "PRINTER"],
  "/inventory": ALL_STAFF_ROLES,
  "/warehouse-navigation": ["ADMIN", "MANAGER", "RECEIVER", "PICKER"],
  "/purchases": ["ADMIN", "MANAGER"],
  "/goods-issues": ["ADMIN", "MANAGER", "PICKER"],
  "/goods-returns": ["ADMIN", "MANAGER", "RECEIVER"],
  "/adjustments": ["ADMIN", "MANAGER", "COUNTER", "RECEIVER"],
  "/suppliers": ["ADMIN", "MANAGER"],
  "/print-jobs": ["ADMIN", "MANAGER", "PRINTER"],
  "/cup-conversions": ["ADMIN", "MANAGER", "PRINTER"],
  "/reports": ["ADMIN", "MANAGER"],
  "/settings": ["ADMIN", "MANAGER"],
  "/staff": ["ADMIN"],
  "/login": ALL_STAFF_ROLES,
} as const satisfies Record<string, readonly WmsRole[]>;

export const MODULE_PRIMARY_ACTION_ROLES = {
  warehouses: ["MANAGER"],
  products: ["ADMIN", "MANAGER"],
  inventory: ALL_STAFF_ROLES,
  purchases: ["ADMIN", "MANAGER"],
  "goods-issues": ["ADMIN", "MANAGER", "PICKER"],
  "goods-returns": ["ADMIN", "RECEIVER"],
  adjustments: ["ADMIN", "MANAGER", "COUNTER", "RECEIVER"],
  suppliers: ["ADMIN", "MANAGER"],
  reports: ["ADMIN", "MANAGER"],
  "print-jobs": ["ADMIN", "MANAGER", "PRINTER"],
  settings: ["ADMIN", "MANAGER"],
  staff: ["ADMIN"],
} as const satisfies Record<string, readonly WmsRole[]>;

export function isWmsRole(value: unknown): value is WmsRole {
  return typeof value === "string" && WMS_ROLE_SET.has(value.toUpperCase());
}

function normalizeRoleValue(value: unknown): readonly WmsRole[] {
  if (typeof value !== "string") {
    return [];
  }

  const normalized = value.trim();
  const upper = normalized.toUpperCase();

  if (isWmsRole(upper)) {
    return [upper];
  }

  return LEGACY_ROLE_MAP[normalized.toLowerCase()] ?? [];
}

export function normalizeRoles(input: unknown): WmsRole[] {
  const values = Array.isArray(input) ? input : [input];
  const roleSet = new Set<WmsRole>();

  values.forEach((value) => {
    normalizeRoleValue(value).forEach((role) => roleSet.add(role));
  });

  return ROLE_PRIORITY.filter((role) => roleSet.has(role));
}

export function hasAnyRole(
  userRoles: readonly WmsRole[] | null | undefined,
  allowedRoles: readonly WmsRole[] | null | undefined,
) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  if (userRoles.includes("ADMIN")) {
    return true;
  }

  const allowed = new Set<WmsRole>(allowedRoles);
  return userRoles.some((role) => allowed.has(role));
}

export function getDefaultRoleFocus(
  roles: readonly WmsRole[] | null | undefined,
) {
  return ROLE_PRIORITY.find((role) => roles?.includes(role)) ?? "MANAGER";
}

export function getAllowedRoutes<T extends { href: string }>(
  routes: readonly T[],
  roles: readonly WmsRole[] | null | undefined,
) {
  return routes.filter((route) =>
    hasAnyRole(roles, getRouteAccess(route.href) ?? []),
  );
}

export function hasRouteAccess(
  href: string,
  roles: readonly WmsRole[] | null | undefined,
) {
  if (RETIRED_ROUTES.has(href)) {
    return false;
  }

  const access = getRouteAccess(href);

  if (!access) {
    return true;
  }

  return hasAnyRole(roles, access);
}

export function getRouteAllowedRoles(href: string) {
  return getRouteAccess(href) ?? ALL_STAFF_ROLES;
}

function getRouteAccess(href: string) {
  return ROUTE_ACCESS_BY_HREF[href as keyof typeof ROUTE_ACCESS_BY_HREF];
}

export function hasModuleActionAccess(
  moduleKey: keyof typeof MODULE_PRIMARY_ACTION_ROLES,
  roles: readonly WmsRole[] | null | undefined,
) {
  return hasAnyRole(roles, MODULE_PRIMARY_ACTION_ROLES[moduleKey]);
}

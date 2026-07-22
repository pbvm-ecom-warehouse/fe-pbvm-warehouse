import { decodeJwt, jwtVerify, type JWTPayload } from "jose";

import {
  getDefaultRoleFocus,
  normalizeRoles,
  ROLE_LABELS,
  type WmsRole,
} from "@/lib/rbac";
import type { WmsUserResponse } from "@/types/api";

export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  roles: WmsRole[];
  tenantId: string;
  warehouseId?: string;
  type: "user";
};

export async function verifyJwt(
  token: string,
  secret = process.env.JWT_SECRET ?? "dev-secret",
) {
  const encodedSecret = new TextEncoder().encode(secret);
  return jwtVerify(token, encodedSecret);
}

type WmsJwtPayload = JWTPayload & {
  email?: unknown;
  id?: unknown;
  name?: unknown;
  role?: unknown;
  roles?: unknown;
  tenantId?: unknown;
  tenant_id?: unknown;
  type?: unknown;
  userId?: unknown;
  username?: unknown;
  warehouseId?: unknown;
  warehouse_id?: unknown;
};

function stringClaim(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export const DEFAULT_SESSION_USER: SessionUser = {
  id: "demo-admin",
  name: "Admin WMS",
  roles: ["ADMIN"],
  tenantId: "demo-tenant",
  type: "user",
};

export function sessionUserFromClaims(
  payload: WmsJwtPayload,
  fallbackTenantId = "demo-tenant",
): SessionUser | null {
  const tokenType = stringClaim(payload.type);

  if (tokenType && tokenType !== "user") {
    return null;
  }

  const roles = normalizeRoles(payload.roles ?? payload.role);

  if (roles.length === 0) {
    return null;
  }

  return {
    id:
      stringClaim(payload.sub) ??
      stringClaim(payload.id) ??
      stringClaim(payload.userId) ??
      "current-user",
    name:
      stringClaim(payload.name) ??
      stringClaim(payload.username) ??
      stringClaim(payload.email) ??
      "Nhân viên WMS",
    email: stringClaim(payload.email),
    roles,
    tenantId:
      stringClaim(payload.tenantId) ??
      stringClaim(payload.tenant_id) ??
      fallbackTenantId,
    warehouseId:
      stringClaim(payload.warehouseId) ?? stringClaim(payload.warehouse_id),
    type: "user",
  };
}

export function sessionUserFromWmsUserResponse(
  user: WmsUserResponse,
  fallback: SessionUser | null = null,
  fallbackTenantId = "demo-tenant",
): SessionUser | null {
  const roles = normalizeRoles(user.role ?? user.roles);

  if (roles.length === 0 || user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: user.id || fallback?.id || "current-user",
    name:
      user.name?.trim() ||
      user.username?.trim() ||
      user.email?.trim() ||
      fallback?.name ||
      "Nhân viên WMS",
    email: user.email?.trim() || fallback?.email,
    roles,
    tenantId: fallback?.tenantId ?? fallbackTenantId,
    warehouseId: user.warehouseId ?? fallback?.warehouseId,
    type: "user",
  };
}

export function sessionUserFromAccessToken(
  accessToken: string,
  fallbackTenantId = "demo-tenant",
) {
  try {
    return sessionUserFromClaims(
      decodeJwt(accessToken) as WmsJwtPayload,
      fallbackTenantId,
    );
  } catch {
    return null;
  }
}

export function getSessionPrimaryRole(user: SessionUser | null | undefined) {
  return getDefaultRoleFocus(user?.roles);
}

export function getSessionRoleLabel(user: SessionUser | null | undefined) {
  return ROLE_LABELS[getSessionPrimaryRole(user)];
}

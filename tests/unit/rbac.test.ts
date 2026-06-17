import { describe, expect, it } from "vitest";

import { dashboardRoutes } from "@/constants/routes";
import {
  getAllowedRoutes,
  getDefaultRoleFocus,
  hasAnyRole,
  hasRouteAccess,
  normalizeRoles,
} from "@/lib/rbac";
import { sessionUserFromAccessToken, sessionUserFromClaims } from "@/lib/auth";

function encodeSegment(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function unsignedJwt(payload: Record<string, unknown>) {
  return `${encodeSegment({ alg: "none", typ: "JWT" })}.${encodeSegment(payload)}.`;
}

describe("WMS RBAC helpers", () => {
  it("normalizes current and legacy roles", () => {
    expect(normalizeRoles(["receiver", "PICKER", "unknown"])).toEqual([
      "RECEIVER",
      "PICKER",
    ]);
    expect(normalizeRoles("warehouse_manager")).toEqual(["MANAGER"]);
    expect(normalizeRoles("operator")).toEqual(["RECEIVER", "PICKER"]);
  });

  it("lets ADMIN bypass role checks", () => {
    expect(hasAnyRole(["ADMIN"], ["COUNTER"])).toBe(true);
    expect(hasRouteAccess("/settings", ["ADMIN"])).toBe(true);
  });

  it("unions permissions for multi-role users", () => {
    expect(hasRouteAccess("/purchases", ["RECEIVER", "PICKER"])).toBe(true);
    expect(hasRouteAccess("/transfers", ["RECEIVER", "PICKER"])).toBe(true);
    expect(hasRouteAccess("/print-jobs", ["RECEIVER", "PICKER"])).toBe(false);
  });

  it("filters sidebar routes by role", () => {
    const receiverRoutes = getAllowedRoutes(dashboardRoutes, ["RECEIVER"]).map(
      (route) => route.href,
    );
    const printerRoutes = getAllowedRoutes(dashboardRoutes, ["PRINTER"]).map(
      (route) => route.href,
    );

    expect(receiverRoutes).toContain("/purchases");
    expect(receiverRoutes).toContain("/warehouse-navigation");
    expect(receiverRoutes).not.toContain("/settings");
    expect(printerRoutes).toContain("/print-jobs");
    expect(printerRoutes).not.toContain("/purchases");
  });

  it("uses the documented priority for default focus", () => {
    expect(getDefaultRoleFocus(["PICKER", "RECEIVER"])).toBe("RECEIVER");
    expect(getDefaultRoleFocus(["COUNTER"])).toBe("COUNTER");
  });
});

describe("WMS session normalization", () => {
  it("builds a session from JWT roles[] claims", () => {
    const token = unsignedJwt({
      sub: "user-1",
      name: "Receiver One",
      roles: ["RECEIVER", "PICKER"],
      tenantId: "tenant-1",
      type: "user",
      warehouseId: "wh-1",
    });

    expect(sessionUserFromAccessToken(token, "fallback-tenant")).toEqual({
      id: "user-1",
      name: "Receiver One",
      roles: ["RECEIVER", "PICKER"],
      tenantId: "tenant-1",
      type: "user",
      warehouseId: "wh-1",
    });
  });

  it("rejects customer tokens for WMS UI sessions", () => {
    expect(
      sessionUserFromClaims({
        roles: ["ADMIN"],
        sub: "customer-1",
        type: "customer",
      }),
    ).toBeNull();
  });
});

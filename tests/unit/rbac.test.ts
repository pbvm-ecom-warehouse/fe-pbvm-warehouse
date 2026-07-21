import { describe, expect, it } from "vitest";

import { dashboardRoutes } from "@/constants/routes";
import {
  getAllowedRoutes,
  getDefaultRoleFocus,
  hasAnyRole,
  hasModuleActionAccess,
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
    expect(normalizeRoles("shipper")).toEqual(["SHIPPER"]);
  });

  it("lets ADMIN bypass role checks", () => {
    expect(hasAnyRole(["ADMIN"], ["COUNTER"])).toBe(true);
    expect(hasRouteAccess("/settings", ["ADMIN"])).toBe(true);
  });

  it("unions permissions for multi-role users", () => {
    expect(hasRouteAccess("/purchases", ["RECEIVER", "PICKER"])).toBe(false);
    expect(hasRouteAccess("/goods-returns", ["RECEIVER", "PICKER"])).toBe(true);
    expect(hasRouteAccess("/goods-issues", ["RECEIVER", "PICKER"])).toBe(true);
    expect(hasRouteAccess("/transfers", ["RECEIVER", "PICKER"])).toBe(false);
    expect(hasRouteAccess("/print-jobs", ["RECEIVER", "PICKER"])).toBe(false);
  });

  it("filters sidebar routes by role", () => {
    const receiverRoutes = getAllowedRoutes(dashboardRoutes, ["RECEIVER"]).map(
      (route) => route.href,
    );
    const printerRoutes = getAllowedRoutes(dashboardRoutes, ["PRINTER"]).map(
      (route) => route.href,
    );
    const shipperRoutes = getAllowedRoutes(dashboardRoutes, ["SHIPPER"]).map(
      (route) => route.href,
    );

    expect(receiverRoutes).not.toContain("/purchases");
    expect(receiverRoutes).not.toContain("/suppliers");
    expect(receiverRoutes).toContain("/goods-returns");
    expect(receiverRoutes).toContain("/warehouse-navigation");
    expect(receiverRoutes).not.toContain("/transfers");
    expect(receiverRoutes).not.toContain("/settings");
    expect(receiverRoutes).not.toContain("/staff");
    expect(printerRoutes).not.toContain("/staff");
    expect(printerRoutes).not.toContain("/transfers");
    expect(printerRoutes).toContain("/print-jobs");
    expect(printerRoutes).not.toContain("/purchases");
    expect(shipperRoutes).toContain("/shipping");
    expect(shipperRoutes).not.toContain("/purchases");
    expect(shipperRoutes).not.toContain("/print-jobs");
  });

  it("exposes Shipping to backend-approved roles only", () => {
    expect(hasRouteAccess("/shipping", ["SHIPPER"])).toBe(true);
    expect(hasRouteAccess("/shipping", ["MANAGER"])).toBe(true);
    expect(hasRouteAccess("/shipping", ["ADMIN"])).toBe(true);
    expect(hasRouteAccess("/shipping", ["RECEIVER"])).toBe(false);
    expect(hasRouteAccess("/shipping", ["PICKER"])).toBe(false);
    expect(hasRouteAccess("/shipping", ["PRINTER"])).toBe(false);
  });

  it("keeps reports directly under dashboard and hides the placeholder inventory route", () => {
    const visibleRoutes = dashboardRoutes
      .filter((route) => route.href !== "/login")
      .map((route) => route.href);

    expect(visibleRoutes.slice(0, 2)).toEqual(["/dashboard", "/reports"]);
    expect(visibleRoutes).not.toContain("/inventory");
    expect(hasRouteAccess("/inventory", ["ADMIN"])).toBe(false);
    expect(hasRouteAccess("/inventory", ["RECEIVER"])).toBe(false);
  });

  it("aligns exposed supplier and purchase APIs with backend roles", () => {
    expect(hasRouteAccess("/suppliers", ["RECEIVER"])).toBe(false);
    expect(hasRouteAccess("/purchases", ["RECEIVER"])).toBe(false);
    expect(hasRouteAccess("/goods-returns", ["RECEIVER"])).toBe(true);
    expect(hasRouteAccess("/suppliers", ["MANAGER"])).toBe(true);
    expect(hasRouteAccess("/purchases", ["MANAGER"])).toBe(true);
    expect(hasRouteAccess("/goods-returns", ["MANAGER"])).toBe(true);
    expect(hasRouteAccess("/staff", ["ADMIN"])).toBe(true);
    expect(hasRouteAccess("/staff", ["MANAGER"])).toBe(true);
    expect(hasModuleActionAccess("suppliers", ["RECEIVER"])).toBe(false);
    expect(hasModuleActionAccess("purchases", ["RECEIVER"])).toBe(false);
    expect(hasModuleActionAccess("goods-returns", ["RECEIVER"])).toBe(true);
    expect(hasModuleActionAccess("goods-returns", ["MANAGER"])).toBe(false);
    expect(hasModuleActionAccess("staff", ["ADMIN"])).toBe(true);
    expect(hasModuleActionAccess("staff", ["MANAGER"])).toBe(true);
    expect(hasModuleActionAccess("suppliers", ["MANAGER"])).toBe(true);
    expect(hasModuleActionAccess("purchases", ["MANAGER"])).toBe(true);
    expect(hasRouteAccess("/warehouses", ["RECEIVER"])).toBe(false);
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

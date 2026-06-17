import { describe, expect, it } from "vitest";

import { loginSchema } from "@/features/auth/schemas/login.schema";

describe("wms login schema", () => {
  it("accepts username and password per WMS auth contract", () => {
    expect(
      loginSchema.safeParse({
        username: "receiver.one",
        password: "P@ssw0rd!",
      }).success,
    ).toBe(true);
  });

  it("rejects the old email plus tenant payload shape", () => {
    expect(
      loginSchema.safeParse({
        email: "ops@pbvm.example",
        password: "P@ssw0rd!",
        tenantId: "demo-tenant",
      }).success,
    ).toBe(false);
  });
});

import { jwtVerify } from "jose";

export type SessionUser = {
  id: string;
  name: string;
  role: "owner" | "warehouse_manager" | "operator";
  tenantId: string;
};

export async function verifyJwt(
  token: string,
  secret = process.env.JWT_SECRET ?? "dev-secret",
) {
  const encodedSecret = new TextEncoder().encode(secret);
  return jwtVerify(token, encodedSecret);
}

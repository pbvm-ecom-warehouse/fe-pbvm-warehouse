import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const tenantId =
    request.headers.get("x-tenant-id") ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    "demo-tenant";

  response.headers.set("x-tenant-id", tenantId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    WMS_API_PROXY_TARGET: z
      .string()
      .url()
      .default("https://api-ecom-wms.hoaiphuong.io.vn"),
  },
  client: {
    NEXT_PUBLIC_WMS_API_URL: z
      .string()
      .min(1)
      .default("/api/wms"),
    NEXT_PUBLIC_DEFAULT_TENANT_ID: z.string().default("demo-tenant"),
  },
  runtimeEnv: {
    WMS_API_PROXY_TARGET: process.env.WMS_API_PROXY_TARGET,
    NEXT_PUBLIC_WMS_API_URL: process.env.NEXT_PUBLIC_WMS_API_URL,
    NEXT_PUBLIC_DEFAULT_TENANT_ID: process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  },
});

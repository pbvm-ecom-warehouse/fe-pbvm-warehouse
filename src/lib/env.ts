import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {},
  client: {
    NEXT_PUBLIC_WMS_API_URL: z
      .string()
      .url()
      .default("http://localhost:3001/api/wms"),
    NEXT_PUBLIC_DEFAULT_TENANT_ID: z.string().default("demo-tenant"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_WMS_API_URL: process.env.NEXT_PUBLIC_WMS_API_URL,
    NEXT_PUBLIC_DEFAULT_TENANT_ID: process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  },
});

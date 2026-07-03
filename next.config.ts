import type { NextConfig } from "next";

const wmsApiProxyTarget = (
  process.env.WMS_API_PROXY_TARGET ?? "https://api-ecom-wms.hoaiphuong.io.vn"
)
  .replace(/\/api\/wms\/?$/, "")
  .replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/wms/:path*",
        destination: `${wmsApiProxyTarget}/api/wms/:path*`,
      },
    ];
  },
};

export default nextConfig;

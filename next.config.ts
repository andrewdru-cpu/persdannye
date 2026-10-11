import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/csp";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

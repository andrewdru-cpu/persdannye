import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/csp";

// Vercel runs `next build` and does not always go through npm prebuild.
const parserGuard = spawnSync(
  process.execPath,
  [path.join(path.dirname(fileURLToPath(import.meta.url)), "scripts", "reject-production-mock-report.mjs")],
  { stdio: "inherit" }
);
if (parserGuard.status !== 0) {
  throw new Error(
    "Сборка остановлена: VERCEL_ENV=production или PD_DEPLOY_ENV=prod, а PARSER_API_BASE не задан. Мок-отчёт в проде запрещён."
  );
}

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

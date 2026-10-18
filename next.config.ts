import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Vercel runs `next build` and does not always go through npm prebuild.
const mockCheck = spawnSync(
  process.execPath,
  [path.join(path.dirname(fileURLToPath(import.meta.url)), "scripts", "reject-production-mocks.mjs")],
  { stdio: "inherit" }
);
if (mockCheck.status !== 0) {
  throw new Error(
    "Сборка остановлена: при VERCEL_ENV=production или PD_DEPLOY_ENV=prod задана непустая E2E, SUPPRESSION_MOCK или OUTBOUND_MOCK, либо PD_BFF_SIGNING_SECRET короче 32 байт."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

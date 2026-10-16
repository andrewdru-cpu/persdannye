import { pathToFileURL } from "node:url";

/** Test switches that must not be set on a Vercel production build. */
export const PRODUCTION_MOCK_KEYS = ["E2E", "SUPPRESSION_MOCK", "OUTBOUND_MOCK"];

/** Non-empty mock keys when VERCEL_ENV is exactly production. NODE_ENV is ignored. */
export function productionMockKeys(env = process.env) {
  if (env.VERCEL_ENV !== "production") return [];
  return PRODUCTION_MOCK_KEYS.filter((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim() !== "";
  });
}

export function productionMockError(keys) {
  return [
    "Сборка production остановлена.",
    `VERCEL_ENV=production, но заданы непустые тестовые переменные: ${keys.join(", ")}.`,
    "Уберите E2E, SUPPRESSION_MOCK и OUTBOUND_MOCK из Production env в Vercel.",
    "Проверяется VERCEL_ENV, не NODE_ENV.",
  ].join("\n");
}

function isCli() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isCli()) {
  const keys = productionMockKeys(process.env);
  if (keys.length > 0) {
    console.error(productionMockError(keys));
    process.exit(1);
  }
}

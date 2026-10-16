import { pathToFileURL } from "node:url";

/** Test switches that must not be set on a Vercel production build. */
export const PRODUCTION_MOCK_KEYS = ["E2E", "SUPPRESSION_MOCK", "OUTBOUND_MOCK"];

/** True for a Vercel production build or an explicit prod deploy. NODE_ENV is ignored. */
export function isProductionDeploy(env = process.env) {
  return env.VERCEL_ENV === "production" || env.PD_DEPLOY_ENV === "prod";
}

/** Non-empty mock keys that block a production deploy. */
export function productionMockKeys(env = process.env) {
  if (!isProductionDeploy(env)) return [];
  return PRODUCTION_MOCK_KEYS.filter((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim() !== "";
  });
}

export function productionMockError(keys, env = process.env) {
  const flags = [];
  if (env.VERCEL_ENV === "production") flags.push("VERCEL_ENV=production");
  if (env.PD_DEPLOY_ENV === "prod") flags.push("PD_DEPLOY_ENV=prod");
  return [
    "Сборка production остановлена.",
    `${flags.join(" и ")}, но заданы непустые тестовые переменные: ${keys.join(", ")}.`,
    "Уберите E2E, SUPPRESSION_MOCK и OUTBOUND_MOCK из прод-окружения.",
    "Проверяются VERCEL_ENV и PD_DEPLOY_ENV, не NODE_ENV.",
  ].join("\n");
}

function isCli() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isCli()) {
  const keys = productionMockKeys(process.env);
  if (keys.length > 0) {
    console.error(productionMockError(keys, process.env));
    process.exit(1);
  }
}

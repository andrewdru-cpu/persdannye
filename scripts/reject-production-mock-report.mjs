import { pathToFileURL } from "node:url";

/**
 * Запрет мок-отчёта в проде, если нет PARSER_API_BASE.
 * Отдельный файл от scripts/reject-production-mocks.mjs в #7
 * (E2E, SUPPRESSION_MOCK, OUTBOUND_MOCK), чтобы правки не сходились в одном модуле.
 * Тот же способ: prebuild и вызов из next.config.ts.
 * Смотрим VERCEL_ENV и PD_DEPLOY_ENV, не NODE_ENV.
 */

export function isProductionDeploy(env = process.env) {
  return env.VERCEL_ENV === "production" || env.PD_DEPLOY_ENV === "prod";
}

export function parserBaseMissing(env = process.env) {
  if (!isProductionDeploy(env)) return false;
  const base = env.PARSER_API_BASE;
  return typeof base !== "string" || base.trim() === "";
}

export function parserBaseMissingError(env = process.env) {
  const flags = [];
  if (env.VERCEL_ENV === "production") flags.push("VERCEL_ENV=production");
  if (env.PD_DEPLOY_ENV === "prod") flags.push("PD_DEPLOY_ENV=prod");
  return [
    "Сборка production остановлена.",
    `${flags.join(" и ")}, но PARSER_API_BASE не задан.`,
    "Мок-отчёт в проде запрещён.",
    "Проверяются VERCEL_ENV и PD_DEPLOY_ENV, не NODE_ENV.",
  ].join("\n");
}

function isCli() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isCli()) {
  if (parserBaseMissing(process.env)) {
    console.error(parserBaseMissingError(process.env));
    process.exit(1);
  }
}

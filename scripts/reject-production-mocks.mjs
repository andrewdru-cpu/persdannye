import { pathToFileURL } from "node:url";

/** Test switches that must not be set on a Vercel production build. */
export const PRODUCTION_MOCK_KEYS = ["E2E", "SUPPRESSION_MOCK", "OUTBOUND_MOCK"];

/** UTF-8 length required of PD_BFF_SIGNING_SECRET. Keep in sync with lib/deploy-env.ts. */
export const MIN_SIGNING_SECRET_BYTES = 32;

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

/** Space, tab, or newline at either end. Keep in sync with lib/deploy-env.ts. The value is not trimmed. */
const SIGNING_SECRET_EDGE = /^[ \t\n]|[ \t\n]$/;
const SIGNING_SECRET_NAMES = ["PD_BFF_SIGNING_SECRET", "PD_BFF_SIGNING_SECRET_PREV"];

/** Variable name when a signing secret has edge whitespace, otherwise null. */
export function paddedSigningSecretName(env = process.env) {
  for (const name of SIGNING_SECRET_NAMES) {
    const value = env[name];
    if (typeof value === "string" && SIGNING_SECRET_EDGE.test(value)) return name;
  }
  return null;
}

export function signingSecretByteLength(env = process.env) {
  const value = env.PD_BFF_SIGNING_SECRET;
  if (typeof value !== "string") return 0;
  if (SIGNING_SECRET_EDGE.test(value)) return 0;
  return Buffer.byteLength(value, "utf8");
}

export function productionSigningSecretError(env = process.env) {
  const bytes = signingSecretByteLength(env);
  const flags = [];
  if (env.VERCEL_ENV === "production") flags.push("VERCEL_ENV=production");
  if (env.PD_DEPLOY_ENV === "prod") flags.push("PD_DEPLOY_ENV=prod");
  return [
    "Сборка production остановлена.",
    `${flags.join(" и ")}, но PD_BFF_SIGNING_SECRET пустой или короче 32 байт (сейчас ${bytes}).`,
    "Задайте PD_BFF_SIGNING_SECRET длиной не меньше 32 байт.",
    "Проверяются VERCEL_ENV и PD_DEPLOY_ENV, не NODE_ENV.",
  ].join("\n");
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
  const padded = paddedSigningSecretName(process.env);
  if (padded) {
    console.error(padded);
    process.exit(1);
  }
  const keys = productionMockKeys(process.env);
  const secretTooShort =
    isProductionDeploy(process.env) && signingSecretByteLength(process.env) < MIN_SIGNING_SECRET_BYTES;
  if (keys.length > 0) console.error(productionMockError(keys, process.env));
  if (secretTooShort) console.error(productionSigningSecretError(process.env));
  if (keys.length > 0 || secretTooShort) process.exit(1);
}

/** Keep in sync with scripts/reject-production-mocks.mjs. NODE_ENV is not a deploy flag. */
export const MIN_SIGNING_SECRET_BYTES = 32;

export function isProductionDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.PD_DEPLOY_ENV === "prod";
}

/** Trimmed secret of at least 32 UTF-8 bytes, or null when it must not be used. */
export function signingSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.PD_BFF_SIGNING_SECRET;
  if (typeof value !== "string") return null;
  const secret = value.trim();
  if (Buffer.byteLength(secret, "utf8") < MIN_SIGNING_SECRET_BYTES) return null;
  return secret;
}

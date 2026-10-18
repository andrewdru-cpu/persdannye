/** Keep in sync with scripts/reject-production-mocks.mjs. NODE_ENV is not a deploy flag. */
export const MIN_SIGNING_SECRET_BYTES = 32;

/** Space, tab, or newline at either end. The value is never trimmed and never logged. */
const SIGNING_SECRET_EDGE = /^[ \t\n]|[ \t\n]$/;

export const SIGNING_SECRET_NAMES = ["PD_BFF_SIGNING_SECRET", "PD_BFF_SIGNING_SECRET_PREV"] as const;

export function isProductionDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.PD_DEPLOY_ENV === "prod";
}

/**
 * Name of a signing secret that has edge whitespace, or null.
 * The returned string is only the variable name.
 */
export function paddedSigningSecretName(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of SIGNING_SECRET_NAMES) {
    const value = env[name];
    if (typeof value === "string" && SIGNING_SECRET_EDGE.test(value)) return name;
  }
  return null;
}

/** Startup check. The error message is the variable name and nothing else. */
export function assertSigningSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const name = paddedSigningSecretName(env);
  if (name) throw new Error(name);
}

/** Secret of at least 32 UTF-8 bytes, or null. Edge whitespace is not stripped. */
function usableSigningSecret(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  if (SIGNING_SECRET_EDGE.test(value)) return null;
  if (Buffer.byteLength(value, "utf8") < MIN_SIGNING_SECRET_BYTES) return null;
  return value;
}

/** Current HMAC key. The BFF signs with this value only. */
export function signingSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return usableSigningSecret(env.PD_BFF_SIGNING_SECRET);
}

/**
 * Optional previous HMAC key for rotation.
 * A missing or shorter value is ignored. The BFF does not sign with it:
 * the parser may still accept a signature made by the previous key.
 */
export function previousSigningSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return usableSigningSecret(env.PD_BFF_SIGNING_SECRET_PREV);
}

import { createHmac } from "node:crypto";
import { isProductionDeploy, signingSecret } from "./deploy-env";

const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Exact Origin values from ALLOWED_ORIGINS. Empty and whitespace-only entries are dropped. */
export function allowedOriginsFromEnv(raw: string | undefined = process.env.ALLOWED_ORIGINS): Set<string> {
  const allowed = new Set<string>();
  if (!raw) return allowed;
  for (const part of raw.split(",")) {
    const origin = part.trim();
    if (origin) allowed.add(origin);
  }
  return allowed;
}

/**
 * Exact string match. A missing header, a blank value, and the browser token "null"
 * are rejected. Prefix and suffix lookalikes are not origins in the list.
 */
export function isAllowedOrigin(origin: string | null, allowed: ReadonlySet<string>): boolean {
  if (origin == null) return false;
  const value = origin.trim();
  if (!value || value === "null") return false;
  return allowed.has(value);
}

function firstAddress(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 64) return null;
  if (IPV4.test(first)) return first;
  if (first.includes(":") && /^[0-9a-fA-F:.]+$/.test(first)) return first;
  return null;
}

/**
 * Client address set by Vercel. x-real-ip wins. Otherwise the first address in
 * x-vercel-forwarded-for. The client X-Forwarded-For header is never read.
 */
export function trustedClientIp(headers: Headers): string | null {
  return firstAddress(headers.get("x-real-ip")) ?? firstAddress(headers.get("x-vercel-forwarded-for"));
}

/** Last IPv4 octet, or the IPv6 interface id, is cleared before anything is logged. */
export function maskIp(ip: string): string {
  if (ip.includes(":")) {
    const parts = ip.split(":").filter((part) => part.length > 0);
    const keep = parts.slice(0, 2).join(":");
    return keep ? `${keep}:*` : "*";
  }
  const match = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip);
  if (match) return `${match[1]}.0`;
  return "*";
}

export function logLeadIp(event: string, headers: Headers): void {
  const ip = trustedClientIp(headers);
  console.info(`[leads] ${event} ip=${ip ? maskIp(ip) : "-"}`);
}

export function stripClientPdHeaders(headers: Headers): void {
  for (const key of [...headers.keys()]) {
    if (key.toLowerCase().startsWith("x-pd-")) headers.delete(key);
  }
}

/**
 * Pathname of the request that is sent to the parser, not the Vercel route.
 * Query, fragment, and a trailing slash are removed: `/public/lead/` and
 * `/public/lead?x=1` both sign as `/public/lead`.
 */
function signaturePathname(path: string): string {
  const withoutFragment = path.split("#", 1)[0] ?? "";
  let pathname = withoutFragment;
  if (/^[a-z][a-z\d+.-]*:/i.test(withoutFragment)) {
    try {
      pathname = new URL(withoutFragment).pathname;
    } catch {
      pathname = withoutFragment;
    }
  }
  const queryAt = pathname.indexOf("?");
  if (queryAt !== -1) pathname = pathname.slice(0, queryAt);
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  return pathname;
}

/**
 * The only signature string the BFF sends to the parser.
 * `<unix seconds>.<METHOD>.<pathname>.<ip>`. METHOD is uppercased.
 * The path is the parser pathname, for example `/public/lead`, never `/api/leads`.
 * Example: `1760817600.POST./public/lead.203.0.113.7`.
 */
export function bffSignatureMaterial(ts: string, method: string, path: string, ip: string): string {
  return `${ts}.${method.toUpperCase()}.${signaturePathname(path)}.${ip}`;
}

/**
 * Encoding of X-PD-Sig. This is the only place it is chosen.
 * Hex until the parser sends its reference vector.
 */
const SIGNATURE_ENCODING = "hex" as const;

/** HMAC-SHA256 of {@link bffSignatureMaterial}, encoded in {@link SIGNATURE_ENCODING}. */
export function signClientPayload(
  ts: string,
  method: string,
  path: string,
  ip: string,
  secret: string
): string {
  const material = bffSignatureMaterial(ts, method, path, ip);
  return createHmac("sha256", secret).update(material).digest(SIGNATURE_ENCODING);
}

/** Unix seconds. Milliseconds are dropped: Math.floor(Date.now() / 1000). */
export function unixSeconds(nowMs: number): string {
  return String(Math.floor(nowMs / 1000));
}

/** Production deploy without a secret of at least 32 bytes. The parser must not be called. */
export function parserSigningBlocked(env: NodeJS.ProcessEnv = process.env): boolean {
  return isProductionDeploy(env) && signingSecret(env) === null;
}

export class ParserUnavailableError extends Error {
  constructor() {
    super("unavailable");
    this.name = "ParserUnavailableError";
  }
}

export function isParserUnavailable(err: unknown): err is ParserUnavailableError {
  return err instanceof ParserUnavailableError || (err instanceof Error && err.name === "ParserUnavailableError");
}

/**
 * Remove any X-PD-* already on the outgoing headers, then set
 * X-PD-Client-IP, X-PD-Ts, and X-PD-Sig when a usable signing secret and a Vercel IP exist.
 * A missing or short secret leaves those headers unset.
 * Call this immediately before fetch. The parser accepts ts only within ±60 seconds,
 * so the clock is read here and the signature is not cached.
 */
export function applySignedClientHeaders(
  headers: Headers,
  incoming: Headers,
  method: string,
  path: string
): void {
  stripClientPdHeaders(headers);
  const secret = signingSecret();
  if (!secret) return;
  const ip = trustedClientIp(incoming);
  if (!ip) return;
  const ts = unixSeconds(Date.now());
  headers.set("X-PD-Client-IP", ip);
  headers.set("X-PD-Ts", ts);
  headers.set("X-PD-Sig", signClientPayload(ts, method, path, ip, secret));
}

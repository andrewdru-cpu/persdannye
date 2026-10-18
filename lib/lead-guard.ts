import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import { isProductionDeploy, signingSecret } from "./deploy-env";

/** Signed address when the process is not on Vercel (`VERCEL` is not `1`). */
export const DEV_CLIENT_IP = "192.0.2.1";

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

/**
 * First address in a header: trim, drop a port and an IPv6 zone id, then `net.isIP`.
 * `203.0.113.10:443` and `fe80::1%eth0` become addresses `isIP` accepts without those suffixes.
 */
function firstAddress(value: string | null): string | null {
  if (!value) return null;
  let token = value.split(",")[0]?.trim() ?? "";
  if (!token) return null;
  const zone = token.indexOf("%");
  if (zone !== -1) token = token.slice(0, zone);
  if (token.startsWith("[")) {
    const end = token.indexOf("]");
    if (end !== -1) token = token.slice(1, end);
  } else {
    const colon = token.lastIndexOf(":");
    if (colon > 0 && token.indexOf(":") === colon) {
      const host = token.slice(0, colon);
      const port = token.slice(colon + 1);
      if (/^\d+$/.test(port) && isIP(host) !== 0) token = host;
    }
  }
  if (isIP(token) === 0) return null;
  return token;
}

/**
 * Address that is signed.
 *
 * Vercel overwrites the incoming `X-Forwarded-For` header and does not keep a
 * browser or upstream-proxy value there (that blocks spoofing). `x-real-ip` is
 * the same address Vercel puts in `X-Forwarded-For`. `x-vercel-forwarded-for`
 * is Vercel's own copy of that address: a proxy placed in front of Vercel can
 * replace `X-Forwarded-For`, and this header still holds what Vercel recorded.
 *
 * Those two headers are read only when `VERCEL=1`, `x-vercel-forwarded-for`
 * first and then `x-real-ip`. A client `x-forwarded-for` is never read. When
 * `VERCEL` is not `1`, the signed address is the fixed {@link DEV_CLIENT_IP}
 * and the request headers are ignored. If both Vercel headers are missing or
 * not addresses, the result is null and the parser must not be called.
 */
export function trustedClientIp(headers: Headers, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL !== "1") return DEV_CLIENT_IP;
  return firstAddress(headers.get("x-vercel-forwarded-for")) ?? firstAddress(headers.get("x-real-ip"));
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
 * SHA-256 hex of the bytes that fetch will send.
 * A missing body and an empty string both hash as the empty byte string.
 * Strings are UTF-8, which is how fetch encodes a string body.
 */
export function bodySha256Hex(body: BodyInit | null | undefined): string {
  const hash = createHash("sha256");
  if (body == null) {
    hash.update("");
  } else if (typeof body === "string") {
    hash.update(body, "utf8");
  } else if (body instanceof URLSearchParams) {
    hash.update(body.toString(), "utf8");
  } else if (body instanceof ArrayBuffer) {
    hash.update(new Uint8Array(body));
  } else if (ArrayBuffer.isView(body)) {
    hash.update(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  } else {
    throw new TypeError("unsupported parser body");
  }
  return hash.digest("hex");
}

/**
 * The only signature string the BFF sends to the parser.
 * `ts\nMETHOD\npathname\nip\nsha256hex(body)`. METHOD is uppercased.
 * The path is the pathname of the URL passed to fetch, never the Vercel route.
 * A lead whose base has no prefix signs `/public/lead`, never `/api/leads`.
 * A base such as `https://host/api` signs `/api/public/lead`, because that is
 * the fetch URL path. Query, fragment, and a trailing slash are omitted.
 * The last field is the hash of the exact fetch body. No body hashes the empty string.
 */
export function bffSignatureMaterial(
  ts: string,
  method: string,
  path: string,
  ip: string,
  body?: BodyInit | null
): string {
  return [ts, method.toUpperCase(), signaturePathname(path), ip, bodySha256Hex(body)].join("\n");
}

/**
 * Encoding of X-PD-Sig. This is the only place it is chosen.
 * Hex is final: hex(HMAC-SHA256(key, `ts\nMETHOD\npath\nip\nsha256hex(body)`)).
 * The key is PD_BFF_SIGNING_SECRET. PD_BFF_SIGNING_SECRET_PREV is not an HMAC key here.
 */
const SIGNATURE_ENCODING = "hex" as const;

/** HMAC-SHA256 of {@link bffSignatureMaterial}, encoded in {@link SIGNATURE_ENCODING}. */
export function signClientPayload(
  ts: string,
  method: string,
  path: string,
  ip: string,
  secret: string,
  body?: BodyInit | null
): string {
  const material = bffSignatureMaterial(ts, method, path, ip, body);
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
  path: string,
  body?: BodyInit | null
): void {
  stripClientPdHeaders(headers);
  const secret = signingSecret();
  if (!secret) return;
  const ip = trustedClientIp(incoming);
  if (!ip) throw new ParserUnavailableError();
  const ts = unixSeconds(Date.now());
  headers.set("X-PD-Client-IP", ip);
  headers.set("X-PD-Ts", ts);
  headers.set("X-PD-Sig", signClientPayload(ts, method, path, ip, secret, body));
}

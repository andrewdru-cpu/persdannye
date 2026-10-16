import { createHmac } from "node:crypto";

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

/** Hex HMAC-SHA256 of `ts + "." + ip`. */
export function signClientPayload(ts: string, ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`${ts}.${ip}`).digest("hex");
}

export function unixSeconds(nowMs: number): string {
  return String(Math.floor(nowMs / 1000));
}

/**
 * Remove any X-PD-* already on the outgoing headers, then set
 * X-PD-Client-IP, X-PD-Ts, and X-PD-Sig when the signing secret and a Vercel IP exist.
 * If PD_BFF_SIGNING_SECRET is missing, none of those headers are set.
 */
export function applySignedClientHeaders(headers: Headers, incoming: Headers, nowMs = Date.now()): void {
  stripClientPdHeaders(headers);
  const secret = process.env.PD_BFF_SIGNING_SECRET?.trim();
  if (!secret) return;
  const ip = trustedClientIp(incoming);
  if (!ip) return;
  const ts = unixSeconds(nowMs);
  headers.set("X-PD-Client-IP", ip);
  headers.set("X-PD-Ts", ts);
  headers.set("X-PD-Sig", signClientPayload(ts, ip, secret));
}

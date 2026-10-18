/**
 * Server-only auth for the upstream parser API.
 * Never import this from client components.
 *
 * Free ngrok URLs show an interstitial unless we send
 * `ngrok-skip-browser-warning` (and a non-browser User-Agent).
 */

import { randomUUID } from "node:crypto";
import { applySignedClientHeaders, ParserUnavailableError, parserSigningBlocked } from "./lead-guard";
import { attemptTimeoutMs, withUnavailableRetry } from "./upstream-retry";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function getParserBase(): string | null {
  const base = (process.env.PARSER_API_BASE || process.env.PARSER_API_URL)?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

export function isParserConfigured(): boolean {
  return Boolean(getParserBase());
}

export function clearParserToken() {
  cachedToken = null;
}

/** Headers required for parser (and ngrok-free) server-side fetches. */
export function applyParserHeaders(headers: Headers): void {
  headers.set("ngrok-skip-browser-warning", "true");
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "PersDannye-BFF/1.0");
  }
}

export function isNgrokInterstitial(res: Response, body: string): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  const sample = body.slice(0, 2000);
  return (
    sample.includes("ERR_NGROK") ||
    sample.includes("ngrok-skip-browser-warning") ||
    (sample.includes("Visit Site") && sample.includes("ngrok"))
  );
}

export function throwIfNgrok(res: Response, body: string): void {
  if (isNgrokInterstitial(res, body)) {
    throw new Error(ngrokErrorMessage(body));
  }
}

function ngrokErrorMessage(body: string): string {
  if (body.includes("ERR_NGROK_3200") || /endpoint .+ is offline/i.test(body)) {
    return "Туннель parser (ngrok) сейчас offline. Проверьте PARSER_API_BASE.";
  }
  return "Parser вернул страницу ngrok вместо JSON. BFF шлёт ngrok-skip-browser-warning — проверьте, что туннель жив.";
}

export async function readParserBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (isNgrokInterstitial(res, text)) {
    throw new Error(ngrokErrorMessage(text));
  }
  return text;
}

export async function parserJson<T>(res: Response): Promise<T> {
  const text = await readParserBody(res);
  if (!text) throw new Error("Пустой ответ parser API");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Parser вернул не JSON");
  }
}

async function parserRequest(
  base: string,
  path: string,
  init: RequestInit,
  auth: boolean,
  client: Headers | undefined,
  startedAt: number
): Promise<Response> {
  if (parserSigningBlocked()) throw new ParserUnavailableError();

  const headers = new Headers(init.headers);
  applyParserHeaders(headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (auth) {
    const token = await getParserBearer(client, startedAt);
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const method = (init.method || "GET").toUpperCase();
  // Sign the URL fetch will open, so a base path prefix is part of the pathname.
  // A retry calls parserRequest again: new ts, same body bytes, same Idempotency-Key.
  const url = `${base}${path}`;
  if (client) applySignedClientHeaders(headers, client, method, url, init.body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), attemptTimeoutMs(startedAt));
  if (init.signal) {
    init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function loginWithPassword(base: string, client: Headers | undefined, startedAt: number): Promise<string> {
  if (parserSigningBlocked()) throw new ParserUnavailableError();

  const email = process.env.PARSER_API_EMAIL?.trim();
  const password = process.env.PARSER_API_PASSWORD;
  if (!email || !password) {
    throw new Error("PARSER_API_EMAIL/PASSWORD не заданы");
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  applyParserHeaders(headers);
  const body = JSON.stringify({ email, password });
  const url = `${base}/api/auth/login`;
  if (client) applySignedClientHeaders(headers, client, "POST", url, body);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(attemptTimeoutMs(startedAt)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (isNgrokInterstitial(res, text)) {
      throw new Error(ngrokErrorMessage(text));
    }
    throw new Error(`Ошибка входа в parser API: ${res.status} ${text}`.slice(0, 400));
  }
  const data = await parserJson<{
    access_token?: string;
    token?: string;
    expires_in?: number;
  }>(res);
  const token = data.access_token || data.token;
  if (!token) throw new Error("Parser login: токен не получен");
  const ttlMs = (data.expires_in ?? 55 * 60) * 1000;
  cachedToken = { token, expiresAt: Date.now() + ttlMs };
  return token;
}

/** Prefer JWT via email/password; fall back to static PARSER_API_TOKEN */
export async function getParserBearer(client?: Headers, startedAt = Date.now()): Promise<string> {
  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  const email = process.env.PARSER_API_EMAIL?.trim();
  const password = process.env.PARSER_API_PASSWORD;
  if (email && password) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      return cachedToken.token;
    }
    return loginWithPassword(base, client, startedAt);
  }

  const staticToken = (process.env.PARSER_API_TOKEN || process.env.PARSER_API_KEY)?.trim();
  if (staticToken) return staticToken;

  throw new Error(
    "Задайте PARSER_API_EMAIL+PARSER_API_PASSWORD или PARSER_API_TOKEN"
  );
}

export async function parserFetch(
  path: string,
  init: RequestInit = {},
  auth = true,
  client?: Headers
): Promise<Response> {
  if (parserSigningBlocked()) throw new ParserUnavailableError();

  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  // 401, 413, and 429 are returned as-is. A 503 with Retry-After is retried once.
  const startedAt = Date.now();
  const request = withScanIdempotency(path, init);
  return withUnavailableRetry(startedAt, () => parserRequest(base, path, request, auth, client, startedAt));
}

/** POST /api/scans gets one Idempotency-Key for the attempt, including a single 503 retry. */
function withScanIdempotency(path: string, init: RequestInit): RequestInit {
  const method = (init.method || "GET").toUpperCase();
  const pathname = (path.split("?")[0] ?? path).replace(/\/+$/, "") || "/";
  if (method !== "POST" || pathname !== "/api/scans") return init;
  const headers = new Headers(init.headers);
  if (!headers.has("idempotency-key")) headers.set("Idempotency-Key", randomUUID());
  return { ...init, headers };
}

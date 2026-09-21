/**
 * Server-only auth for the upstream parser API.
 * Never import this from client components.
 *
 * Free ngrok URLs show an interstitial unless we send
 * `ngrok-skip-browser-warning` (and a non-browser User-Agent).
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

export function getParserBase(): string | null {
  const base = (process.env.PARSER_API_BASE || process.env.PARSER_API_URL)?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

export function isParserConfigured(): boolean {
  return Boolean(getParserBase());
}

function clearParserToken() {
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
  auth: boolean
): Promise<Response> {
  const headers = new Headers(init.headers);
  applyParserHeaders(headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (auth) {
    const token = await getParserBearer();
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  if (init.signal) {
    init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loginWithPassword(base: string): Promise<string> {
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

  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
    cache: "no-store",
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
export async function getParserBearer(): Promise<string> {
  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  const email = process.env.PARSER_API_EMAIL?.trim();
  const password = process.env.PARSER_API_PASSWORD;
  if (email && password) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      return cachedToken.token;
    }
    return loginWithPassword(base);
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
  auth = true
): Promise<Response> {
  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let res = await parserRequest(base, path, init, auth);
      if (auth && res.status === 401) {
        clearParserToken();
        res = await parserRequest(base, path, init, auth);
      }
      if ([502, 503, 504, 429].includes(res.status) && attempt < 2) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : "";
      const retryable =
        name === "AbortError" ||
        /offline|ngrok|aborted|fetch|network|ECONNRESET|ETIMEDOUT/i.test(msg);
      if (!retryable || attempt === 2) throw err;
      await sleep(400 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Parser request failed");
}

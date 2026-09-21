/**
 * Server-only auth for the upstream parser API.
 * Never import this from client components.
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

async function loginWithPassword(base: string): Promise<string> {
  const email = process.env.PARSER_API_EMAIL?.trim();
  const password = process.env.PARSER_API_PASSWORD;
  if (!email || !password) {
    throw new Error("PARSER_API_EMAIL/PASSWORD не заданы");
  }
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ошибка входа в parser API: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    token?: string;
    expires_in?: number;
  };
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

  const doFetch = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (auth) {
      const token = await getParserBearer();
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
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
  };

  let res = await doFetch();
  if (auth && res.status === 401) {
    clearParserToken();
    res = await doFetch();
  }
  return res;
}

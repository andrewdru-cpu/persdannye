/**
 * Прокси статуса скана к парсеру в том же compose.
 * Тело заявки этот модуль не принимает и не логирует.
 */

import { findingsForClient, scanHasRisks } from "./check-report";
import { friendlyPhaseMessage, normalizePhase } from "./phases";
import type { CheckJob, Finding, Recommendation } from "./types";
import { domainFromUrl } from "./utils";

export const DEFAULT_PARSER_API_BASE = "http://api:8080";

const SCAN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PARSER_TIMEOUT_MS = 20_000;

export function parserApiBase(): string {
  const raw = process.env.PARSER_API_BASE?.trim() || DEFAULT_PARSER_API_BASE;
  const base = raw.replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error("bad_parser_base");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("bad_parser_base");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("bad_parser_base");
  }
  return url.origin + url.pathname.replace(/\/$/, "");
}

export function parserApiToken(): string | null {
  const token = process.env.PARSER_API_TOKEN?.trim() ?? "";
  if (!token || token.length > 4096 || /[\r\n\s]/.test(token)) return null;
  return token;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIpv6(value: string): boolean {
  if (!value.includes(":") || value.includes("%") || value.length > 64) return false;
  try {
    const url = new URL(`http://[${value}]/`);
    return url.hostname.startsWith("[") && url.hostname.endsWith("]");
  } catch {
    return false;
  }
}

/**
 * Адрес клиента только из X-Real-IP, который ставит Caddy.
 * X-Forwarded-For не читается: его может прислать сам браузер.
 */
export function clientIpFromRealIp(headers: Headers): string | null {
  const raw = headers.get("x-real-ip");
  if (raw == null) return null;
  const value = raw.trim();
  if (!value || /\s/.test(value) || value.includes(",")) return null;
  if (!isIpv4(value) && !isIpv6(value)) return null;
  return value;
}

export function isScanId(id: string): boolean {
  return SCAN_ID.test(id);
}

export function jsonError(status: number, error: string, headers?: HeadersInit): Response {
  return Response.json(
    { error },
    {
      status,
      headers: { "cache-control": "no-store", ...Object.fromEntries(new Headers(headers)) },
    },
  );
}

async function discard(res: Response): Promise<void> {
  await res.arrayBuffer().catch(() => undefined);
}

function retryAfter(res: Response): HeadersInit | undefined {
  const value = res.headers.get("retry-after");
  if (value && /^\d{1,6}$/.test(value)) return { "retry-after": value };
  return undefined;
}

/** Статусы парсера наружу, без тела: в нём могут быть эхо ПДн и внутренние детали. */
export async function responseFromParser(res: Response): Promise<Response | null> {
  if (res.status === 400 || res.status === 422) {
    await discard(res);
    return jsonError(res.status, "Некорректный запрос");
  }
  if (res.status === 429) {
    await discard(res);
    return jsonError(429, "Слишком много запросов", retryAfter(res));
  }
  if (res.status >= 500 && res.status <= 599) {
    await discard(res);
    return jsonError(res.status, "Сервис временно недоступен");
  }
  if (!res.ok) {
    await discard(res);
    return jsonError(502, "Сервис временно недоступен");
  }
  return null;
}

async function readParserJson(res: Response): Promise<unknown | Response> {
  const length = Number(res.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 1_048_576) {
    await discard(res);
    return jsonError(502, "Сервис временно недоступен");
  }
  const text = await res.text();
  if (text.length > 1_048_576) return jsonError(502, "Сервис временно недоступен");
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return jsonError(502, "Сервис временно недоступен");
  }
}

export function publicScan(id: string, data: unknown, fallbackUrl = ""): CheckJob {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const url = typeof record.url === "string" && record.url.length <= 2048 ? record.url : fallbackUrl;
  let domain = "";
  try {
    domain = url ? domainFromUrl(url) : "";
  } catch {
    domain = "";
  }
  const phaseRaw =
    typeof record.phase === "string" ? record.phase : typeof record.status === "string" ? record.status : "queued";
  const phase = normalizePhase(phaseRaw);
  const findings = Array.isArray(record.findings)
    ? findingsForClient(record.findings.filter((item): item is Finding => Boolean(item) && typeof item === "object"))
    : [];
  const recommendations = Array.isArray(record.recommendations)
    ? record.recommendations.filter((item): item is Recommendation => Boolean(item) && typeof item === "object")
    : [];
  const push = record.push === true;
  const done = phase === "done";
  const now = new Date().toISOString();
  const pdfReady = record.pdf_ready === true || record.pdfReady === true || record.has_pdf === true;
  return {
    id,
    url,
    domain,
    scanId: id,
    phase,
    phaseMessage: friendlyPhaseMessage(String(phase), domain || "сайт"),
    score: typeof record.score === "number" && Number.isFinite(record.score) ? record.score : null,
    findings,
    recommendations,
    hasRisks: scanHasRisks(done, push, findings),
    push,
    pdfReady,
    warning: null,
    error: phase === "error" || phase === "blocked" ? friendlyPhaseMessage(String(phase), domain || "сайт") : null,
    createdAt: now,
    updatedAt: now,
    mock: false,
  };
}

function parserHeaders(token: string, ip?: string): Headers {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  headers.set("accept", "application/json");
  if (ip) headers.set("x-pd-client-ip", ip);
  return headers;
}

async function parserFetch(path: string, init: RequestInit): Promise<Response> {
  const base = parserApiBase();
  return fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(PARSER_TIMEOUT_MS),
  });
}

export async function fetchScan(id: string, ip: string): Promise<Response> {
  if (!isScanId(id)) return jsonError(400, "Некорректный идентификатор");
  if (!ip) return jsonError(400, "Не указан адрес клиента");
  const token = parserApiToken();
  if (!token) return jsonError(500, "Ошибка сервера");

  let upstream: Response;
  try {
    upstream = await parserFetch(`/api/scans/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: parserHeaders(token, ip),
    });
  } catch {
    return jsonError(502, "Сервис временно недоступен");
  }
  if (upstream.status === 404) {
    await discard(upstream);
    return jsonError(404, "Проверка не найдена");
  }
  const forwarded = await responseFromParser(upstream);
  if (forwarded) return forwarded;
  const data = await readParserJson(upstream);
  if (data instanceof Response) return data;
  return Response.json(publicScan(id, data), { headers: { "cache-control": "no-store" } });
}

export async function fetchScanPdf(id: string, ip: string): Promise<Response> {
  if (!isScanId(id)) return jsonError(400, "Некорректный идентификатор");
  if (!ip) return jsonError(400, "Не указан адрес клиента");
  const token = parserApiToken();
  if (!token) return jsonError(500, "Ошибка сервера");

  let upstream: Response;
  try {
    const headers = parserHeaders(token, ip);
    headers.set("accept", "application/pdf");
    upstream = await parserFetch(`/api/scans/${encodeURIComponent(id)}/pdf`, {
      method: "GET",
      headers,
    });
  } catch {
    return jsonError(502, "Сервис временно недоступен");
  }
  if (upstream.status === 404 || upstream.status === 409) {
    await discard(upstream);
    return jsonError(404, "PDF ещё не готов");
  }
  const forwarded = await responseFromParser(upstream);
  if (forwarded) return forwarded;
  const type = (upstream.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/json") || type.includes("text/plain")) {
    await discard(upstream);
    return jsonError(502, "Сервис временно недоступен");
  }
  const buffer = await upstream.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > 15 * 1024 * 1024) {
    return jsonError(502, "Сервис временно недоступен");
  }
  return new Response(buffer, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="persdannye-report.pdf"',
      "cache-control": "no-store",
    },
  });
}

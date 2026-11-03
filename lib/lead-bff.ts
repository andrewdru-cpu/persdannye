/**
 * BFF к парсеру на том же compose. Персональные данные не пишутся на диск
 * и не уходят никуда, кроме POST/GET парсера. В логи попадают только коды событий.
 */

import { findingsForClient, scanHasRisks } from "./check-report";
import { marketingConsentForParser } from "./consent";
import { friendlyPhaseMessage, normalizePhase } from "./phases";
import type { CheckJob, Finding, Recommendation } from "./types";
import { domainFromUrl, normalizeUrl } from "./utils";

export const LEAD_BODY_LIMIT = 16 * 1024;
export const DEFAULT_PARSER_API_BASE = "http://api:8080";
export const HONEYPOT_FIELD = "fax";

const SCAN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CONSENT_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SOURCE = /^[a-z0-9-]{1,64}$/;
const PARSER_TIMEOUT_MS = 20_000;

export type LeadInput = {
  url: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  consentVersion?: string;
  consentAt?: string;
  marketingConsent: boolean;
  marketingConsentVersion?: string;
  source: string;
};

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

export function isHoneypotTripped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function isScanId(id: string): boolean {
  return SCAN_ID.test(id);
}

function textField(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  return trimmed;
}

function validConsentAt(value: string): boolean {
  if (!CONSENT_AT.test(value)) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  if (time - Date.now() > 10 * 60 * 1000) return false;
  if (Date.now() - time > 7 * 24 * 60 * 60 * 1000) return false;
  return true;
}

export function validateLead(body: unknown): { ok: true; lead: LeadInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Некорректные данные" };
  }
  const record = body as Record<string, unknown>;
  const nameRaw = record.name;
  const emailRaw = record.email;
  const phoneRaw = record.phone;
  const messageRaw = record.message;
  const urlRaw = record.url;

  if (nameRaw != null && typeof nameRaw !== "string") return { ok: false, error: "Некорректные данные" };
  if (emailRaw != null && typeof emailRaw !== "string") return { ok: false, error: "Некорректные данные" };
  if (phoneRaw != null && typeof phoneRaw !== "string") return { ok: false, error: "Некорректные данные" };
  if (messageRaw != null && typeof messageRaw !== "string") return { ok: false, error: "Некорректные данные" };
  if (urlRaw != null && typeof urlRaw !== "string") return { ok: false, error: "Некорректные данные" };

  if (typeof nameRaw === "string" && nameRaw.trim().length > 120) return { ok: false, error: "Некорректные данные" };
  if (typeof emailRaw === "string" && emailRaw.trim().length > 200) return { ok: false, error: "Некорректные данные" };
  if (typeof phoneRaw === "string" && phoneRaw.trim().length > 40) return { ok: false, error: "Некорректные данные" };
  if (typeof messageRaw === "string" && messageRaw.trim().length > 4000) return { ok: false, error: "Некорректные данные" };
  if (typeof urlRaw === "string" && urlRaw.trim().length > 2048) return { ok: false, error: "Некорректный URL" };

  const name = textField(nameRaw, 120);
  const email = textField(emailRaw, 200);
  const phone = textField(phoneRaw, 40);
  const message = textField(messageRaw, 4000);
  const hasContact = Boolean(name || email || phone || message);

  if (hasContact && record.consent !== true) {
    return { ok: false, error: "Нужно согласие на обработку персональных данных" };
  }

  if (typeof urlRaw !== "string" || !urlRaw.trim()) {
    return { ok: false, error: "Укажите ссылку на сайт" };
  }
  let url: string;
  try {
    url = normalizeUrl(urlRaw);
  } catch {
    return { ok: false, error: "Некорректный URL" };
  }

  if (name && name.length < 2) return { ok: false, error: "Укажите имя" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Некорректный email" };
  }
  if (phone && /[\r\n]/.test(phone)) return { ok: false, error: "Некорректные данные" };

  let consentVersion: string | undefined;
  let consentAt: string | undefined;
  if (hasContact) {
    if (!email && !phone) return { ok: false, error: "Укажите телефон или e-mail" };
    if (typeof record.consent_version !== "string" || !record.consent_version.trim()) {
      return { ok: false, error: "Укажите версию согласия" };
    }
    consentVersion = record.consent_version.trim();
    if (consentVersion.length > 64) return { ok: false, error: "Укажите версию согласия" };
    if (typeof record.consent_at !== "string" || !validConsentAt(record.consent_at.trim())) {
      return { ok: false, error: "Укажите время согласия" };
    }
    consentAt = record.consent_at.trim();
  }

  const marketingConsent = record.marketing_consent === true;
  let marketingConsentVersion: string | undefined;
  if (marketingConsent) {
    const version = marketingConsentForParser(true).marketing_consent_text_version;
    if (typeof record.marketing_consent_text_version === "string") {
      const given = record.marketing_consent_text_version.trim();
      if (!given || given.length > 32) return { ok: false, error: "Некорректные данные" };
      marketingConsentVersion = given;
    } else {
      marketingConsentVersion = version;
    }
  }

  const sourceRaw = typeof record.source === "string" ? record.source.trim() : "";
  const source = SOURCE.test(sourceRaw) ? sourceRaw : "landing";

  return {
    ok: true,
    lead: {
      url,
      name,
      email,
      phone,
      message,
      consentVersion,
      consentAt,
      marketingConsent,
      marketingConsentVersion,
      source,
    },
  };
}

export function scanCreatePayload(lead: LeadInput): Record<string, unknown> {
  const payload: Record<string, unknown> = { url: lead.url, mode: "quick" };
  if (!lead.email && !lead.phone && !lead.name && !lead.message) return payload;
  const contact: Record<string, unknown> = {
    consent: true,
    consent_version: lead.consentVersion,
    consent_at: lead.consentAt,
    source: lead.source,
    ...marketingConsentForParser(lead.marketingConsent),
  };
  if (lead.marketingConsent && lead.marketingConsentVersion) {
    contact.marketing_consent_text_version = lead.marketingConsentVersion;
  }
  if (lead.name) contact.name = lead.name;
  if (lead.email) contact.email = lead.email;
  if (lead.phone) contact.phone = lead.phone;
  if (lead.message) contact.message = lead.message;
  payload.lead = contact;
  return payload;
}

export function jsonError(status: number, error: string, headers?: HeadersInit): Response {
  return Response.json(
    { error },
    {
      status,
      headers: { "cache-control": "no-store", ...Object.fromEntries(new Headers(headers)) },
    }
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
  if (res.status === 400) {
    await discard(res);
    return jsonError(400, "Некорректный запрос");
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

function scanIdFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const id = record.scan_id ?? record.id;
  if (typeof id !== "string" || !isScanId(id)) return null;
  return id;
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

export async function readLimitedBody(req: Request, max = LEAD_BODY_LIMIT): Promise<
  { ok: true; text: string } | { ok: false; response: Response }
> {
  const declared = req.headers.get("content-length");
  if (declared != null) {
    if (!/^\d+$/.test(declared) || Number(declared) > max) {
      return { ok: false, response: jsonError(413, "Слишком большой запрос") };
    }
  }
  const reader = req.body?.getReader();
  if (!reader) return { ok: true, text: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, response: jsonError(413, "Слишком большой запрос") };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(body) };
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

export async function submitLead(req: Request): Promise<Response> {
  const limited = await readLimitedBody(req);
  if (!limited.ok) return limited.response;
  let json: unknown;
  try {
    json = limited.text ? JSON.parse(limited.text) : null;
  } catch {
    return jsonError(400, "Некорректные данные");
  }
  if (isHoneypotTripped(json)) {
    return Response.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  }
  const parsed = validateLead(json);
  if (!parsed.ok) return jsonError(400, parsed.error);

  const ip = clientIpFromRealIp(req.headers);
  if (!ip) return jsonError(400, "Не указан адрес клиента");

  const token = parserApiToken();
  if (!token) return jsonError(500, "Ошибка сервера");

  let upstream: Response;
  try {
    const headers = parserHeaders(token, ip);
    headers.set("content-type", "application/json");
    upstream = await parserFetch("/api/scans", {
      method: "POST",
      headers,
      body: JSON.stringify(scanCreatePayload(parsed.lead)),
    });
  } catch {
    return jsonError(502, "Сервис временно недоступен");
  }

  const forwarded = await responseFromParser(upstream);
  if (forwarded) return forwarded;

  const data = await readParserJson(upstream);
  if (data instanceof Response) return data;
  const id = scanIdFrom(data);
  if (!id) return jsonError(502, "Сервис временно недоступен");
  const job = publicScan(id, { url: parsed.lead.url, phase: "queued" }, parsed.lead.url);
  return Response.json({ ok: true, ...job }, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function fetchScan(id: string): Promise<Response> {
  if (!isScanId(id)) return jsonError(400, "Некорректный идентификатор");
  const token = parserApiToken();
  if (!token) return jsonError(500, "Ошибка сервера");

  let upstream: Response;
  try {
    upstream = await parserFetch(`/api/scans/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: parserHeaders(token),
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

export async function fetchScanPdf(id: string): Promise<Response> {
  if (!isScanId(id)) return jsonError(400, "Некорректный идентификатор");
  const token = parserApiToken();
  if (!token) return jsonError(500, "Ошибка сервера");

  let upstream: Response;
  try {
    const headers = parserHeaders(token);
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

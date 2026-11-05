/**
 * Браузер шлёт заявку и проверку напрямую в API в РФ.
 * Этот модуль не пишет поля формы в лог и не ходит на свой origin.
 */

import { findingsForClient, scanHasRisks } from "./check-report";
import { CONSENT_TEXT_VERSION, LEAD_CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "./consent";
import { friendlyPhaseMessage, normalizePhase } from "./phases";
import type { CheckJob, Finding, Recommendation } from "./types";
import { domainFromUrl, normalizeUrl } from "./utils";

export const RU_API_ORIGIN = "https://api.scanweb.pro";
export const RU_BODY_LIMIT = 16 * 1024;

const SCAN_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function ruPublicUrl(path: string): string {
  if (!path.startsWith("/public/") || path.includes("..") || path.includes("\\")) {
    throw new Error("Некорректный адрес");
  }
  const url = new URL(path, RU_API_ORIGIN);
  if (url.origin !== RU_API_ORIGIN || !url.pathname.startsWith("/public/")) {
    throw new Error("Некорректный адрес");
  }
  return url.toString();
}

export function ruCheckStatusUrl(id: string): string {
  if (!SCAN_ID.test(id)) throw new Error("Некорректный идентификатор");
  return ruPublicUrl(`/public/check/${encodeURIComponent(id)}`);
}

export function ruCheckPdfUrl(id: string): string {
  if (!SCAN_ID.test(id)) throw new Error("Некорректный идентификатор");
  return ruPublicUrl(`/public/check/${encodeURIComponent(id)}/pdf`);
}

function siteUrl(value: string): string {
  return normalizeUrl(value);
}

export function buildRuLeadBody(input: {
  name: string;
  email?: string;
  phone?: string;
  url: string;
  checkId?: string;
  source?: string;
  marketing: boolean;
}): Record<string, unknown> {
  const name = input.name.trim();
  const email = input.email?.trim() || "";
  const phone = input.phone?.trim() || "";
  const checkId = input.checkId?.trim() || "";
  const source = input.source?.trim() || "";
  const body: Record<string, unknown> = {
    name,
    url: siteUrl(input.url),
    consent: { accepted: true, text_version: LEAD_CONSENT_TEXT_VERSION },
  };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (checkId && SCAN_ID.test(checkId)) body.check_id = checkId;
  if (source) body.source = source;
  if (email && input.marketing) {
    body.marketing_consent = {
      accepted: true,
      text_version: MARKETING_CONSENT_TEXT_VERSION,
    };
  }
  return body;
}

export function buildRuCheckBody(input: {
  url: string;
  email?: string;
  marketing: boolean;
}): Record<string, unknown> {
  const email = input.email?.trim() || "";
  const body: Record<string, unknown> = { url: siteUrl(input.url) };
  if (!email) return body;
  body.email = email;
  body.consent = { accepted: true, text_version: CONSENT_TEXT_VERSION };
  if (input.marketing) {
    body.marketing_consent = {
      accepted: true,
      text_version: MARKETING_CONSENT_TEXT_VERSION,
    };
  }
  return body;
}

function readId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const id = record.scan_id ?? record.id;
  if (typeof id !== "string" || !SCAN_ID.test(id)) return null;
  return id;
}

/** Поля отчёта без контактов заявки. Тело ответа наружу не логируется. */
export function publicCheckFromRu(data: unknown, fallbackUrl = ""): CheckJob | null {
  const id = readId(data);
  if (!id) return null;
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

async function discard(res: Response): Promise<void> {
  await res.arrayBuffer().catch(() => undefined);
}

async function postJson(path: "/public/lead" | "/public/check", body: Record<string, unknown>): Promise<unknown> {
  const raw = JSON.stringify(body);
  if (raw.length > RU_BODY_LIMIT) throw new Error("Слишком большой запрос");
  let res: Response;
  try {
    res = await fetch(ruPublicUrl(path), {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: raw,
    });
  } catch {
    throw new Error("Ошибка отправки");
  }
  if (!res.ok) {
    await discard(res);
    throw new Error(res.status === 429 ? "Слишком много запросов" : "Ошибка отправки");
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Ошибка отправки");
  }
}

export async function postRuLead(input: Parameters<typeof buildRuLeadBody>[0]): Promise<void> {
  await postJson("/public/lead", buildRuLeadBody(input));
}

export async function postRuCheck(input: Parameters<typeof buildRuCheckBody>[0]): Promise<CheckJob> {
  const data = await postJson("/public/check", buildRuCheckBody(input));
  const job = publicCheckFromRu(data, input.url.trim());
  if (!job) throw new Error("Не удалось запустить проверку");
  return job;
}

export async function getRuCheck(id: string, fallbackUrl = ""): Promise<CheckJob> {
  let res: Response;
  try {
    res = await fetch(ruCheckStatusUrl(id), { cache: "no-store", credentials: "omit" });
  } catch {
    throw new Error("Ошибка опроса");
  }
  if (!res.ok) {
    await discard(res);
    throw new Error("Ошибка опроса");
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Ошибка опроса");
  }
  const job = publicCheckFromRu(data, fallbackUrl);
  if (!job) throw new Error("Ошибка опроса");
  return job;
}

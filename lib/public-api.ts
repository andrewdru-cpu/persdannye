import {
  jobHasRisks,
  normalizeFindings,
  readRulesVersion,
  readStaticFallback,
} from "./finding-status";
import { friendlyPhaseMessage, isLimitedScan, normalizePhase } from "./phases";
import { SMARTCAPTCHA_TOKEN_FIELD } from "./smartcaptcha";
import type { CheckJob, Finding } from "./types";
import { domainFromUrl, normalizeUrl } from "./utils";
import { getPublicApiBase } from "./forms-mode";

export class PublicApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.code = code;
  }
}

export type PublicContactInput = {
  name?: string;
  email?: string;
  phone?: string;
};

export type PublicCheckInput = PublicContactInput & {
  url: string;
  consentAccepted?: boolean;
  textVersion?: string;
  smartToken?: string;
};

export type PublicLeadInput = PublicContactInput & {
  company?: string;
  url?: string;
  checkId?: string;
  message?: string;
  source?: string;
  consentAccepted?: boolean;
  textVersion?: string;
  smartToken?: string;
};

type FetchLike = typeof fetch;

function apiBase(): string {
  const base = getPublicApiBase();
  if (!base) {
    throw new PublicApiError("Публичный API не настроен", 0, "config");
  }
  return base;
}

/** Absolute URL on the public API. Refuses anything outside /public/*. */
export function joinPublicApi(path: string): string {
  if (!path.startsWith("/public/") || path.includes("/api/")) {
    throw new PublicApiError("Некорректный адрес публичного API", 0, "config");
  }
  const url = `${apiBase()}${path}`;
  const parsed = new URL(url);
  if (parsed.pathname.startsWith("/api/") || parsed.pathname.includes("/api/")) {
    throw new PublicApiError("Некорректный адрес публичного API", 0, "config");
  }
  return url;
}

export function publicCheckPdfUrl(id: string): string {
  return joinPublicApi(`/public/check/${encodeURIComponent(id)}/pdf`);
}

function compactContact(input: PublicContactInput): PublicContactInput | null {
  const name = input.name?.trim() || undefined;
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  if (!name && !email && !phone) return null;
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

function requireCaptcha(token: string | undefined): string {
  const smartToken = token?.trim() || "";
  if (!smartToken) {
    throw new PublicApiError("Подтвердите, что вы не робот", 0, "captcha_required");
  }
  return smartToken;
}

function requireConsent(accepted: boolean | undefined, textVersion: string | undefined): {
  accepted: true;
  text_version: string;
} {
  const version = textVersion?.trim() || "";
  if (accepted !== true || !version) {
    throw new PublicApiError(
      "Нужно согласие на обработку персональных данных",
      422,
      "consent_required"
    );
  }
  return { accepted: true, text_version: version };
}

export function buildPublicCheckBody(input: PublicCheckInput): Record<string, unknown> {
  let url: string;
  try {
    url = normalizeUrl(input.url);
  } catch {
    throw new PublicApiError("Некорректный URL", 400, "bad_url");
  }
  const body: Record<string, unknown> = {
    url,
    [SMARTCAPTCHA_TOKEN_FIELD]: requireCaptcha(input.smartToken),
  };
  const contacts = compactContact(input);
  if (contacts) {
    body.contacts = contacts;
    body.consent = requireConsent(input.consentAccepted, input.textVersion);
  }
  return body;
}

export function buildPublicLeadBody(input: PublicLeadInput): Record<string, unknown> {
  const name = input.name?.trim() || "";
  const email = input.email?.trim() || "";
  if (name.length < 2) {
    throw new PublicApiError("Укажите имя", 400, "bad_name");
  }
  if (!email.includes("@")) {
    throw new PublicApiError("Некорректный email", 400, "bad_email");
  }
  const phone = input.phone?.trim() || undefined;
  const company = input.company?.trim() || undefined;
  const site = input.url?.trim() || undefined;
  const message = input.message?.trim() || undefined;
  const source = input.source?.trim() || undefined;
  const checkId = input.checkId?.trim() || undefined;
  return {
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(company ? { company } : {}),
    ...(site ? { url: site } : {}),
    ...(checkId ? { check_id: checkId } : {}),
    ...(message ? { message } : {}),
    ...(source ? { source } : {}),
    [SMARTCAPTCHA_TOKEN_FIELD]: requireCaptcha(input.smartToken),
    consent: requireConsent(input.consentAccepted, input.textVersion),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function publicErrorCode(body: unknown): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  for (const key of ["error", "code"]) {
    const value = record[key];
    if (typeof value === "string" && /^[a-z0-9_]+$/i.test(value)) return value;
  }
  const detail = asRecord(record.detail);
  if (detail && typeof detail.code === "string" && /^[a-z0-9_]+$/i.test(detail.code)) {
    return detail.code;
  }
  return undefined;
}

export function publicErrorMessage(status: number, body: unknown): string {
  const code = publicErrorCode(body);
  if (code === "consent_required") {
    return "Нужно согласие на обработку персональных данных";
  }
  if (status === 429 || code === "rate_limited" || code === "too_many_requests") {
    return "Слишком много запросов. Попробуйте чуть позже.";
  }
  if (code === "captcha_required" || code === "captcha_failed" || code === "invalid_captcha") {
    return "Подтвердите, что вы не робот";
  }
  if (status === 404) return "Проверка не найдена";
  if (status === 422) return "Проверьте поля формы";
  if (code === "config") return "Публичный API не настроен";
  return "Сервис проверки временно недоступен";
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function textField(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/** Findings only: drop contacts, screenshots, and any extra keys. */
export function sanitizeFindings(value: unknown): Finding[] {
  return normalizeFindings(value);
}

function mapPhase(data: Record<string, unknown>): string {
  const raw = data.phase ?? data.status ?? "queued";
  const key = String(raw).trim().toLowerCase();
  if (key === "running" || key === "processing" || key === "in_progress") return "extract";
  return String(normalizePhase(key));
}

function boolField(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function mapCreatedCheck(body: unknown, submittedUrl: string): CheckJob {
  const record = asRecord(body);
  const checkId = textField(record?.check_id, 128);
  if (!checkId) {
    throw new PublicApiError("Публичный API не вернул check_id", 502, "bad_response");
  }
  let url = submittedUrl;
  try {
    url = normalizeUrl(submittedUrl);
  } catch {
    url = submittedUrl;
  }
  const now = new Date().toISOString();
  const domain = domainFromUrl(url);
  return {
    id: checkId,
    url,
    domain,
    phase: "queued",
    phaseMessage: friendlyPhaseMessage("queued", domain),
    score: null,
    findings: [],
    hasRisks: false,
    staticFallback: false,
    rulesVersion: null,
    pdfReady: false,
    reportUrl: safeHttpUrl(record?.report_url),
    warning: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    mock: false,
  };
}

export function mapPublicCheck(body: unknown, fallbackUrl: string, id: string): CheckJob {
  const record = asRecord(body) ?? {};
  const checkId = textField(record.check_id, 128) || id;
  let url = textField(record.url, 2000) || fallbackUrl;
  try {
    if (url) url = normalizeUrl(url);
  } catch {
    /* keep the raw url string for display */
  }
  const domain = domainFromUrl(url || fallbackUrl);
  const phase = mapPhase(record);
  const findings = sanitizeFindings(record.findings);
  const score = typeof record.score === "number" ? record.score : null;
  const done = phase === "done";
  const pdfFlag = boolField(record.pdf_ready);
  const pdfReady = pdfFlag ?? done;
  const hasRisks = jobHasRisks({
    phase,
    push: typeof record.push === "boolean" ? record.push : undefined,
    findings,
  });
  const now = new Date().toISOString();

  return {
    id: checkId,
    url,
    domain,
    phase,
    phaseMessage: friendlyPhaseMessage(phase, domain),
    score,
    findings,
    hasRisks,
    staticFallback: readStaticFallback(record.mode),
    rulesVersion: readRulesVersion(record.rules_version),
    pdfReady,
    reportUrl: safeHttpUrl(record.report_url),
    warning: null,
    error:
      isLimitedScan(phase) || (phase !== "error" && phase !== "blocked")
        ? null
        : friendlyPhaseMessage(phase, domain),
    createdAt: now,
    updatedAt: now,
    mock: false,
  };
}

export function mergeReportUrl(previous: CheckJob | null | undefined, next: CheckJob): CheckJob {
  if (!next.reportUrl && previous?.reportUrl && previous.id === next.id) {
    return { ...next, reportUrl: previous.reportUrl };
  }
  return next;
}

async function postPublic(
  path: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike
): Promise<{ status: number; json: unknown }> {
  const res = await fetchImpl(joinPublicApi(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
  const json = await readJson(res);
  return { status: res.status, json };
}

export async function createPublicCheck(
  input: PublicCheckInput,
  fetchImpl: FetchLike = fetch
): Promise<CheckJob> {
  const body = buildPublicCheckBody(input);
  const { status, json } = await postPublic("/public/check", body, fetchImpl);
  if (status !== 202) {
    throw new PublicApiError(publicErrorMessage(status, json), status, publicErrorCode(json));
  }
  return mapCreatedCheck(json, String(body.url));
}

export async function getPublicCheck(
  id: string,
  previous?: CheckJob | null,
  fetchImpl: FetchLike = fetch
): Promise<CheckJob> {
  const res = await fetchImpl(joinPublicApi(`/public/check/${encodeURIComponent(id)}`), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw new PublicApiError(publicErrorMessage(res.status, json), res.status, publicErrorCode(json));
  }
  const mapped = mapPublicCheck(json, previous?.url || "", id);
  return mergeReportUrl(previous, mapped);
}

export async function createPublicLead(
  input: PublicLeadInput,
  fetchImpl: FetchLike = fetch
): Promise<{ ok: true }> {
  const body = buildPublicLeadBody(input);
  const { status, json } = await postPublic("/public/lead", body, fetchImpl);
  if (status !== 201) {
    throw new PublicApiError(publicErrorMessage(status, json), status, publicErrorCode(json));
  }
  return { ok: true };
}

import {
  jobHasRisks,
  normalizeFindings,
  normalizeInventory,
  readRulesVersion,
  readStaticFallback,
} from "./finding-status";
import { friendlyPhaseMessage, isLimitedScan, normalizePhase } from "./phases";
import { SMARTCAPTCHA_TOKEN_FIELD } from "./smartcaptcha";
import type { CheckJob, Finding } from "./types";
import { domainFromUrl, normalizeUrl } from "./utils";
import { getPublicApiBase } from "./forms-mode";
import { publicCheckRecord } from "./public-check-schema";
import { CONSENT_TEXT_VERSION } from "../content/consent";
import {
  DIRECT_LEAD_CONSENT_TEXT_VERSION,
  DIRECT_MARKETING_CONSENT_TEXT_VERSION,
} from "./consent";

export class PublicApiError extends Error {
  status: number;
  code?: string;
  fields?: string[];
  retryAfter?: number;

  constructor(
    message: string,
    status = 0,
    code?: string,
    fields?: string[],
    retryAfter?: number
  ) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
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
  marketingConsent?: boolean;
  textVersion?: string;
  smartToken?: string;
};

export type PublicLeadInput = PublicContactInput & {
  /** Ignored on the direct wire: the lead consent does not list a company. */
  company?: string;
  url?: string;
  checkId?: string;
  message?: string;
  source?: string;
  consentAccepted?: boolean;
  /**
   * Direct mode sends marketing_consent only when this is true and email is set.
   * `false` and a missing email omit the key. `accepted: false` is never sent.
   */
  marketingAccepted?: boolean;
  /** Ignored. Direct lead consent version is fixed in the client. */
  textVersion?: string;
  smartToken?: string;
  /** UUID v4. Reused for retries of the same payload. */
  idempotencyKey?: string;
};

const LEAD_BODY_LIMIT = 16 * 1024;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function isIdempotencyKey(value: string): boolean {
  return UUID_V4.test(value);
}

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

function requireConsent(accepted: boolean | undefined): {
  accepted: true;
  text_version: string;
} {
  if (accepted !== true) {
    throw new PublicApiError(
      "Нужно согласие на обработку персональных данных",
      422,
      "consent_required"
    );
  }
  return { accepted: true, text_version: CONSENT_TEXT_VERSION };
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
    body.consent = requireConsent(input.consentAccepted);
  }
  return body;
}

function leadSiteUrl(value: string | undefined): string | undefined {
  const raw = value?.trim() || "";
  if (!raw) return undefined;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new PublicApiError("Некорректный URL", 400, "validation_failed", ["url"]);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PublicApiError("Некорректный URL", 400, "validation_failed", ["url"]);
  }
  return parsed.toString();
}

function requireLeadConsent(accepted: boolean | undefined): {
  accepted: true;
  text_version: string;
} {
  if (accepted !== true) {
    throw new PublicApiError(
      "Нужно согласие на обработку персональных данных",
      422,
      "consent_required"
    );
  }
  return { accepted: true, text_version: DIRECT_LEAD_CONSENT_TEXT_VERSION };
}

export function buildPublicLeadBody(input: PublicLeadInput): Record<string, unknown> {
  const name = input.name?.trim() || "";
  const email = input.email?.trim() || "";
  const phone = input.phone?.trim() || "";
  if (name.length < 2 || name.length > 120) {
    throw new PublicApiError("Укажите имя", 400, "validation_failed", ["name"]);
  }
  if (!email && !phone) {
    throw new PublicApiError("Укажите телефон или e-mail", 400, "validation_failed", ["email", "phone"]);
  }
  if (email && (email.length > 200 || !email.includes("@"))) {
    throw new PublicApiError("Некорректный email", 400, "validation_failed", ["email"]);
  }
  if (phone.length > 40) {
    throw new PublicApiError("Некорректный телефон", 400, "validation_failed", ["phone"]);
  }
  const site = leadSiteUrl(input.url);
  const message = input.message?.trim() || undefined;
  const source = input.source?.trim() || undefined;
  const checkId = input.checkId?.trim() || undefined;
  const body: Record<string, unknown> = {
    name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(site ? { url: site } : {}),
    ...(checkId ? { check_id: checkId } : {}),
    ...(message ? { message } : {}),
    ...(source ? { source } : {}),
    [SMARTCAPTCHA_TOKEN_FIELD]: requireCaptcha(input.smartToken),
    consent: requireLeadConsent(input.consentAccepted),
  };
  if (email && input.marketingAccepted === true) {
    body.marketing_consent = {
      accepted: true,
      text_version: DIRECT_MARKETING_CONSENT_TEXT_VERSION,
    };
  }
  return body;
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

export function publicErrorFields(body: unknown): string[] {
  const record = asRecord(body);
  const fields = record?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function publicErrorMessage(status: number, body: unknown): string {
  const code = publicErrorCode(body);
  if (code === "consent_required") {
    return "Нужно согласие на обработку персональных данных";
  }
  if (code === "consent_version_unknown") {
    return "Обновите страницу и повторите";
  }
  if (code === "validation_failed") return "Проверьте поля формы";
  if (code === "idempotency_key_invalid") return "Не удалось отправить заявку. Обновите страницу и повторите.";
  if (code === "idempotency_key_reused") return "Данные заявки изменились. Отправьте форму ещё раз.";
  if (code === "idempotency_in_progress") return "Заявка ещё отправляется. Повторите через несколько секунд.";
  if (code === "origin_forbidden") return "Отправка с этого адреса недоступна";
  if (code === "captcha_unavailable") return "Проверка временно недоступна. Попробуйте ещё раз.";
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
export function sanitizeFindings(value: unknown, showAmounts?: unknown): Finding[] {
  return normalizeFindings(value, showAmounts);
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
  const record = publicCheckRecord(body);
  const checkId = textField(record.check_id, 128) || id;
  let url = textField(record.url, 2000) || fallbackUrl;
  try {
    if (url) url = normalizeUrl(url);
  } catch {
    /* keep the raw url string for display */
  }
  const domain = domainFromUrl(url || fallbackUrl);
  const phase = mapPhase(record);
  const findings = sanitizeFindings(record.findings, record.show_amounts);
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
    inventory: normalizeInventory(record.inventory),
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

function retryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function retryDelayMs(header: string | null, attempt: number): number {
  const seconds = retryAfterSeconds(header);
  if (seconds !== undefined) return Math.min(seconds * 1000, 1500);
  return Math.min(200 * 2 ** attempt, 800);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPublic(
  path: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: unknown; retryAfter: string | null }> {
  const payload = JSON.stringify(body);
  const res = await fetchImpl(joinPublicApi(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: payload,
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
  const json = await readJson(res);
  return { status: res.status, json, retryAfter: res.headers.get("retry-after") };
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
): Promise<{ ok: true; id: string }> {
  const key = input.idempotencyKey?.trim() || createIdempotencyKey();
  if (!isIdempotencyKey(key)) {
    throw new PublicApiError(
      publicErrorMessage(400, { error: "idempotency_key_invalid" }),
      400,
      "idempotency_key_invalid"
    );
  }
  const body = buildPublicLeadBody(input);
  const raw = JSON.stringify(body);
  if (new TextEncoder().encode(raw).length > LEAD_BODY_LIMIT) {
    throw new PublicApiError("Сообщение слишком длинное", 400, "validation_failed", ["message"]);
  }
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let status = 0;
    let json: unknown = null;
    let retryAfter: string | null = null;
    try {
      const response = await postPublic("/public/lead", body, fetchImpl, { "Idempotency-Key": key });
      status = response.status;
      json = response.json;
      retryAfter = response.retryAfter;
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      await sleep(retryDelayMs(null, attempt));
      continue;
    }
    if (status === 201) {
      const record = asRecord(json);
      const id = record && typeof record.id === "string" ? record.id : "";
      return { ok: true, id };
    }
    const code = publicErrorCode(json);
    const fields = publicErrorFields(json);
    const retry = (status === 409 && code === "idempotency_in_progress") || (status === 503 && code === "captcha_unavailable");
    if (retry && attempt < maxAttempts - 1) {
      await sleep(retryDelayMs(retryAfter, attempt));
      continue;
    }
    throw new PublicApiError(
      publicErrorMessage(status, json),
      status,
      code,
      fields,
      retryAfterSeconds(retryAfter)
    );
  }
  throw new PublicApiError("Сервис проверки временно недоступен", 0);
}

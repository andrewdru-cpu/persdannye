import { getParserBase, isParserConfigured, parserFetch, parserJson, readParserBody, throwIfNgrok } from "./parser-auth";
import { mockCreateScan, mockGetScan } from "./mock-parser";
import {
  friendlyPhaseMessage,
  isTerminal,
  normalizePhase,
  type ParserPhase,
} from "./phases";
import type { CheckJob, Finding, ScanContact } from "./types";
import { domainFromUrl } from "./utils";
import {
  findScanContact,
  hasScanContact,
  mergeScanContact,
  normalizeScanContact,
  saveScanContact,
} from "./scan-contacts";
import { randomUUID } from "crypto";

export { isParserConfigured, getParserBase };

interface UpstreamCreate {
  scan_id?: string;
  id?: string;
  queued?: boolean;
  warning?: string | null;
}

interface UpstreamScan {
  scan_id?: string;
  id?: string;
  url?: string;
  phase?: string;
  status?: string;
  phase_message?: string | null;
  score?: number | null;
  findings?: Finding[];
  push?: boolean;
  warning?: string | null;
  error?: string | null;
  message?: string | null;
  pdf_ready?: boolean;
  pdfReady?: boolean;
  has_pdf?: boolean;
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
  } | null;
}

type JobMeta = {
  url: string;
  scanId: string;
  mock: boolean;
  createdAt: string;
  warning?: string | null;
  lead?: ScanContact | null;
};

/** In-memory map: our check id → upstream scan_id (or mock) */
const jobMeta = new Map<string, JobMeta>();

export type CreateScanLead = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** 400/422 that complains about fields the parser build does not know yet. */
export function isUnknownFieldRejection(status: number, text: string): boolean {
  if (status !== 400 && status !== 422) return false;
  return /unknown|unexpected|additional|extra[_\s-]?forbidden|extra inputs|unrecognized|not permitted|not allowed|unexpected field|additional propert|\bmode\b|\blead\b|неизвестн|лишн|не поддерж/i.test(
    text
  );
}

function resolvePdfReady(data: UpstreamScan, phase: string): boolean {
  if (typeof data.pdf_ready === "boolean") return data.pdf_ready;
  if (typeof data.pdfReady === "boolean") return data.pdfReady;
  if (typeof data.has_pdf === "boolean") return data.has_pdf;
  return phase === "done";
}

function mapUpstream(
  checkId: string,
  url: string,
  data: UpstreamScan,
  mock: boolean,
  createdAt: string,
  warning?: string | null
): CheckJob {
  const domain = domainFromUrl(url);
  const phase = normalizePhase(data.phase || data.status || "queued") as ParserPhase | string;
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const push = Boolean(data.push);
  const done = phase === "done";
  const hasRisks = done ? push || findings.length > 0 : push;

  return {
    id: checkId,
    url,
    domain,
    scanId: data.scan_id || data.id || checkId,
    phase,
    phaseMessage: friendlyPhaseMessage(
      phase,
      domain,
      data.phase_message || data.message
    ),
    score: data.score ?? null,
    findings,
    hasRisks,
    push,
    pdfReady: mock ? false : resolvePdfReady(data, phase),
    warning: data.warning ?? warning ?? null,
    error: data.error ?? (phase === "error" ? data.message : null) ?? null,
    contact: normalizeScanContact(data.lead),
    createdAt,
    updatedAt: new Date().toISOString(),
    mock,
  };
}

function scanCreateBody(
  url: string,
  contact: ScanContact | null,
  opts: { mode: boolean; lead: boolean }
): Record<string, unknown> {
  const body: Record<string, unknown> = { url };
  if (opts.mode) body.mode = "quick";
  if (opts.lead && contact) {
    body.lead = {
      ...(contact.name ? { name: contact.name } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
      source: "landing",
    };
  }
  return body;
}

async function postScan(body: Record<string, unknown>): Promise<Response> {
  return parserFetch("/api/scans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Landing checks always ask for quick mode. Lead contacts go with the same
 * body when the visitor filled them. An older parser that rejects unknown
 * fields is retried without `lead`, then with `{ url }` only.
 */
async function createUpstreamScan(
  url: string,
  contact: ScanContact | null
): Promise<UpstreamCreate> {
  const attempts: Record<string, unknown>[] = [
    scanCreateBody(url, contact, { mode: true, lead: Boolean(contact) }),
  ];
  if (contact) {
    attempts.push(scanCreateBody(url, null, { mode: true, lead: false }));
  }
  attempts.push({ url });

  let lastStatus = 0;
  let lastText = "";
  for (let i = 0; i < attempts.length; i++) {
    const res = await postScan(attempts[i]);
    if (res.ok) return parserJson<UpstreamCreate>(res);

    const text = await readParserBody(res);
    lastStatus = res.status;
    lastText = text;
    const canFallback = i < attempts.length - 1 && isUnknownFieldRejection(res.status, text);
    if (!canFallback) break;
    console.info(
      `[parser] create scan rejected extra fields (${res.status}), retrying a simpler body`
    );
  }

  throw new Error(
    `Не удалось создать сканирование: ${lastStatus} ${lastText}`.slice(0, 400)
  );
}

async function rememberContact(
  id: string,
  url: string,
  contact: ScanContact | null
): Promise<void> {
  if (!hasScanContact(contact) || !contact) return;
  try {
    await saveScanContact(id, url, contact);
  } catch (err) {
    console.error("[scan-contact] save failed", err);
  }
}

async function resolveContact(
  id: string,
  metaLead?: ScanContact | null,
  upstream?: ScanContact | null
): Promise<ScanContact | null> {
  let stored = hasScanContact(metaLead) ? metaLead : null;
  if (!stored) {
    try {
      stored = await findScanContact(id);
    } catch (err) {
      console.error("[scan-contact] read failed", err);
    }
  }
  return mergeScanContact(stored, upstream);
}

function remember(checkId: string, meta: JobMeta) {
  jobMeta.set(checkId, meta);
}

export async function createCheck(
  url: string,
  lead?: CreateScanLead | null
): Promise<CheckJob> {
  const createdAt = new Date().toISOString();
  const domain = domainFromUrl(url);
  const contact = normalizeScanContact(lead);

  if (!isParserConfigured()) {
    const id = randomUUID();
    mockCreateScan(id, url);
    remember(id, { url, scanId: id, mock: true, createdAt, lead: contact });
    await rememberContact(id, url, contact);
    const job = mockGetScan(id)!;
    return { ...job, id, createdAt, contact };
  }

  const data = await createUpstreamScan(url, contact);
  const scanId = data.scan_id || data.id;
  if (!scanId) {
    throw new Error("Parser API не вернул scan_id");
  }

  // Use upstream scan_id as public check id so serverless polls can recover.
  const id = scanId;
  remember(id, {
    url,
    scanId,
    mock: false,
    createdAt,
    warning: data.warning,
    lead: contact,
  });
  await rememberContact(id, url, contact);

  return {
    id,
    url,
    domain,
    scanId,
    phase: "queued",
    phaseMessage: friendlyPhaseMessage("queued", domain),
    score: null,
    findings: [],
    hasRisks: false,
    pdfReady: false,
    warning: data.warning ?? null,
    contact,
    createdAt,
    updatedAt: createdAt,
    mock: false,
  };
}

export async function getCheck(id: string): Promise<CheckJob | null> {
  const meta = jobMeta.get(id);

  if (meta?.mock || !isParserConfigured()) {
    const job = mockGetScan(id);
    if (!job) return null;
    const contact = await resolveContact(id, meta?.lead, job.contact);
    return { ...job, contact };
  }

  const scanId = meta?.scanId || id;
  const res = await parserFetch(`/api/scans/${scanId}`, { method: "GET" });
  if (res.status === 404) {
    const text = await res.text().catch(() => "");
    throwIfNgrok(res, text);
    return mockGetScan(id);
  }
  if (!res.ok) {
    const text = await readParserBody(res);
    throw new Error(`Ошибка статуса скана: ${res.status} ${text}`.slice(0, 400));
  }
  const data = await parserJson<UpstreamScan>(res);
  const url = meta?.url || data.url || "";
  const createdAt = meta?.createdAt || new Date().toISOString();
  if (!meta) {
    remember(id, {
      url,
      scanId,
      mock: false,
      createdAt,
      warning: data.warning,
    });
  }
  const mapped = mapUpstream(id, url, data, false, createdAt, meta?.warning);
  const contact = await resolveContact(id, meta?.lead, mapped.contact);
  return { ...mapped, contact };
}

export async function getCheckPdf(
  id: string
): Promise<{ buffer: Buffer; filename: string; contentType: string } | null> {
  if (!isParserConfigured()) return null;
  const meta = jobMeta.get(id);
  if (meta?.mock) return null;

  const scanId = meta?.scanId || id;
  const res = await parserFetch(`/api/scans/${scanId}/pdf`, {
    method: "GET",
    headers: { Accept: "application/pdf" },
  });
  if (res.status === 404 || res.status === 409) {
    const text = await res.text().catch(() => "");
    throwIfNgrok(res, text);
    return null;
  }
  if (!res.ok) {
    const text = await readParserBody(res);
    throw new Error(`Не удалось получить PDF: ${res.status} ${text}`.slice(0, 400));
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html")) {
    throw new Error("Parser вернул HTML вместо PDF (туннель ngrok или ошибка).");
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) return null;
  const domain = meta?.url ? domainFromUrl(meta.url) : "report";
  const safe = domain.replace(/[^a-z0-9.-]/gi, "_") || "report";
  return {
    buffer,
    filename: `persdannye-${safe}.pdf`,
    contentType: res.headers.get("content-type") || "application/pdf",
  };
}

export function checkIsTerminal(job: CheckJob): boolean {
  return isTerminal(String(job.phase));
}

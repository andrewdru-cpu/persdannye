import { getParserBase, isParserConfigured, parserFetch } from "./parser-auth";
import { mockCreateScan, mockGetScan } from "./mock-parser";
import {
  friendlyPhaseMessage,
  isTerminal,
  normalizePhase,
  type ParserPhase,
} from "./phases";
import type { CheckJob, Finding } from "./types";
import { domainFromUrl } from "./utils";
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
}

/** In-memory map: our check id → upstream scan_id (or mock) */
const jobMeta = new Map<
  string,
  { url: string; scanId: string; mock: boolean; createdAt: string; warning?: string | null }
>();

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
    createdAt,
    updatedAt: new Date().toISOString(),
    mock,
  };
}

function remember(
  checkId: string,
  meta: { url: string; scanId: string; mock: boolean; createdAt: string; warning?: string | null }
) {
  jobMeta.set(checkId, meta);
}

export async function createCheck(url: string): Promise<CheckJob> {
  const createdAt = new Date().toISOString();
  const domain = domainFromUrl(url);

  if (!isParserConfigured()) {
    const id = randomUUID();
    mockCreateScan(id, url);
    remember(id, { url, scanId: id, mock: true, createdAt });
    const job = mockGetScan(id)!;
    return { ...job, id, createdAt };
  }

  const res = await parserFetch("/api/scans", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Не удалось создать сканирование: ${res.status} ${text}`);
  }
  const data = (await res.json()) as UpstreamCreate;
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
  });

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
    createdAt,
    updatedAt: createdAt,
    mock: false,
  };
}

export async function getCheck(id: string): Promise<CheckJob | null> {
  const meta = jobMeta.get(id);

  if (meta?.mock || !isParserConfigured()) {
    return mockGetScan(id);
  }

  const scanId = meta?.scanId || id;
  const res = await parserFetch(`/api/scans/${scanId}`, { method: "GET" });
  if (res.status === 404) {
    const mock = mockGetScan(id);
    return mock;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ошибка статуса скана: ${res.status} ${text}`);
  }
  const data = (await res.json()) as UpstreamScan;
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
  return mapUpstream(id, url, data, false, createdAt, meta?.warning);
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
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Не удалось получить PDF: ${res.status} ${text}`);
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

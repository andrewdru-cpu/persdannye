import { getParserBase, isParserConfigured, parserFetch } from "./parser-auth";
import { mockCreateScan, mockGetScan } from "./mock-parser";
import {
  friendlyPhaseMessage,
  isTerminal,
  type ParserPhase,
} from "./phases";
import type { CheckJob, Finding } from "./types";
import { domainFromUrl } from "./utils";
import { randomUUID } from "crypto";

export { isParserConfigured, getParserBase };

interface UpstreamCreate {
  scan_id: string;
  queued?: boolean;
  warning?: string | null;
}

interface UpstreamScan {
  scan_id?: string;
  id?: string;
  url?: string;
  phase: string;
  phase_message?: string | null;
  score?: number | null;
  findings?: Finding[];
  push?: boolean;
  warning?: string | null;
  error?: string | null;
  message?: string | null;
}

/** In-memory map: our check id → upstream scan_id (or mock) */
const jobMeta = new Map<
  string,
  { url: string; scanId: string; mock: boolean; createdAt: string; warning?: string | null }
>();

function mapUpstream(
  checkId: string,
  url: string,
  data: UpstreamScan,
  mock: boolean,
  createdAt: string,
  warning?: string | null
): CheckJob {
  const domain = domainFromUrl(url);
  const phase = (data.phase || "queued") as ParserPhase | string;
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const push = Boolean(data.push);
  const done = phase === "done";
  const hasRisks = done ? push || findings.length > 0 : push;

  return {
    id: checkId,
    url,
    domain,
    scanId: data.scan_id || data.id,
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
    warning: data.warning ?? warning ?? null,
    error: data.error ?? (phase === "error" ? data.message : null) ?? null,
    createdAt,
    updatedAt: new Date().toISOString(),
    mock,
  };
}

export async function createCheck(url: string): Promise<CheckJob> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const domain = domainFromUrl(url);

  if (!isParserConfigured()) {
    mockCreateScan(id, url);
    jobMeta.set(id, { url, scanId: id, mock: true, createdAt });
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
  jobMeta.set(id, {
    url,
    scanId: data.scan_id,
    mock: false,
    createdAt,
    warning: data.warning,
  });

  return {
    id,
    url,
    domain,
    scanId: data.scan_id,
    phase: "queued",
    phaseMessage: friendlyPhaseMessage("queued", domain),
    score: null,
    findings: [],
    hasRisks: false,
    warning: data.warning ?? null,
    createdAt,
    updatedAt: createdAt,
    mock: false,
  };
}

export async function getCheck(id: string): Promise<CheckJob | null> {
  const meta = jobMeta.get(id);
  if (!meta) {
    // allow recovering mock by id if process kept mock map
    const mock = mockGetScan(id);
    return mock;
  }

  if (meta.mock || !isParserConfigured()) {
    return mockGetScan(id);
  }

  const res = await parserFetch(`/api/scans/${meta.scanId}`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ошибка статуса скана: ${res.status} ${text}`);
  }
  const data = (await res.json()) as UpstreamScan;
  return mapUpstream(id, meta.url, data, false, meta.createdAt, meta.warning);
}

export function checkIsTerminal(job: CheckJob): boolean {
  return isTerminal(String(job.phase));
}

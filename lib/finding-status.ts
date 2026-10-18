import { showFineAmounts } from "./forms-mode";
import { isLimitedScan } from "./phases";
import type { Finding, FindingSeverity, InventoryItem, StatusBasis } from "./types";

const SEVERITY_ALIASES: Record<string, FindingSeverity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  s: "critical",
  a: "high",
  b: "medium",
  info: "info",
};

export const LIKELY_BASIS_TEXT = "вероятное нарушение, квалификацию оценивает юрист";
export const FINE_INTERPRETATION_LABEL = "по оценке юриста";
export const INVENTORY_HEADING = "Что мы нашли на сайте";
export const ROBOTS_PARTIAL_EXPLANATION = "сайт запретил автоматический обход части страниц";

/**
 * Statuses that count as a violation once the parser sends `status`.
 * Not in the public contract yet — this list is an assumption.
 * A finding with no status is a legacy finding and still counts.
 */
const VIOLATION_STATUSES = new Set(["violation", "fail", "failed", "non_compliant"]);

const STATUS_TOKEN = /^[a-z0-9_-]{1,40}$/;

/** Normalized status token, or null when the field is absent. */
export function findingStatusToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase();
  if (!token) return null;
  if (STATUS_TOKEN.test(token)) return token;
  return "unknown";
}

/** Same token rules as a finding status. Invalid text becomes "unknown". */
export function findingReasonToken(value: unknown): string | null {
  return findingStatusToken(value);
}

/**
 * Legacy findings (no status) and the explicit violation set.
 * `reason: robots_disallow` was not checked, so it is never a violation.
 */
export function isViolation(finding: { status?: string | null; reason?: string | null }): boolean {
  if (findingReasonToken(finding.reason) === "robots_disallow") return false;
  const status = findingStatusToken(finding.status);
  if (!status) return true;
  return VIOLATION_STATUSES.has(status);
}

export function violationCount(
  findings: Array<{ status?: string | null }> | null | undefined
): number {
  if (!Array.isArray(findings)) return 0;
  let count = 0;
  for (const finding of findings) {
    if (isViolation(finding)) count += 1;
  }
  return count;
}

/**
 * Badge copy for a non-violation status. Explicit violations keep the
 * severity badge only. Unknown tokens stay neutral and are not echoed.
 */
export function findingStatusLabel(status: string | null | undefined): string | null {
  const token = findingStatusToken(status);
  if (!token || VIOLATION_STATUSES.has(token)) return null;
  if (token === "needs_check") return "требует проверки";
  if (token === "not_checked") return "не проверено";
  return "не классифицировано";
}

/**
 * Done scans follow the violation counter. `push` remains a legacy signal
 * only while every finding has no status (including an empty list).
 * In-progress scans still follow `push` alone.
 */
export function jobHasRisks(input: {
  phase: string;
  push?: boolean | null;
  findings: Array<{ status?: string | null; reason?: string | null }>;
}): boolean {
  if (isLimitedScan(input.phase)) return false;
  if (input.phase !== "done") return Boolean(input.push);
  if (violationCount(input.findings) > 0) return true;
  const legacy = input.findings.every((finding) => findingStatusToken(finding.status) === null);
  return Boolean(input.push) && legacy;
}

/** Partial check is `mode=static_fallback`. A boolean flag does not count. */
export function readStaticFallback(mode: unknown): boolean {
  return typeof mode === "string" && mode.trim().toLowerCase() === "static_fallback";
}

/**
 * One-off site-form check where robots.txt Disallow: / left only the home
 * page and the policy checked. Other findings stay not_checked.
 */
export function isRobotsPartial(
  findings: Array<{ status?: string | null; reason?: string | null }> | null | undefined
): boolean {
  if (!Array.isArray(findings)) return false;
  return findings.some(
    (finding) =>
      findingReasonToken(finding.reason) === "robots_disallow" &&
      findingStatusToken(finding.status) === "not_checked"
  );
}

export function readStatusBasis(value: unknown): StatusBasis | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (key === "proven" || key === "likely") return key;
  return null;
}

export function readSeverity(value: unknown): FindingSeverity {
  const key = textField(value, 20).toLowerCase();
  return SEVERITY_ALIASES[key] || "info";
}

/** Non-empty string, or null when the field is absent or blank. */
export function readRulesVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

function textField(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Amount text only when the site flag is on, the scan says `show_amounts: true`,
 * and the text is a non-empty string. Otherwise nothing — no placeholder.
 */
export function visibleFineAmount(fineAmountText: unknown, showAmounts: unknown): string | null {
  if (!showFineAmounts()) return null;
  if (showAmounts !== true) return null;
  if (typeof fineAmountText !== "string") return null;
  const text = fineAmountText.trim();
  if (!text) return null;
  return text.slice(0, 200);
}

/**
 * Informational rows. Only checklist_item_id, title, and detail are kept.
 * Hidden rows are already removed by the parser, so every remaining object
 * is shown. Blank objects are dropped.
 */
export function normalizeInventory(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];
  const items: InventoryItem[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const checklistItemId = textField(record.checklist_item_id, 80);
    const title = textField(record.title, 300);
    const detail = textField(record.detail, 1000);
    if (!checklistItemId && !title && !detail) continue;
    const next: InventoryItem = {};
    if (checklistItemId) next.checklist_item_id = checklistItemId;
    if (title) next.title = title;
    if (detail) next.detail = detail;
    items.push(next);
  }
  return items;
}

/** Text findings only. `status` is copied only when the parser sent one. */
export function normalizeFindings(value: unknown, showAmounts?: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  const findings: Finding[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const ruleId = textField(record.rule_id, 80);
    const title = textField(record.title, 300);
    const fact = textField(record.fact, 1000);
    if (!ruleId || !title || !fact) continue;
    const finding: Finding = { rule_id: ruleId, title, fact, severity: readSeverity(record.severity) };
    const status = findingStatusToken(record.status);
    if (status) finding.status = status;
    const reason = findingReasonToken(record.reason);
    if (reason) finding.reason = reason;
    const basis = readStatusBasis(record.status_basis);
    if (basis) finding.statusBasis = basis;
    const rawBasis = textField(record.status_basis, 40);
    if (rawBasis) finding.status_basis = rawBasis;
    const remediation = textField(record.remediation, 2000);
    if (remediation) finding.remediation = remediation;
    if (record.fine === null || typeof record.fine === "number") finding.fine = record.fine as number | null;
    const meta = asRecord(record.meta);
    const disclaimer = textField(meta?.disclaimer, 1000);
    if (disclaimer) finding.disclaimer = disclaimer;
    const fineNorm = textField(record.fine_norm, 300);
    if (fineNorm) finding.fineNorm = fineNorm;
    if (record.fine_interpretation === true) finding.fineInterpretation = true;
    const fineAmount = visibleFineAmount(record.fine_amount_text, showAmounts);
    if (fineAmount) finding.fineAmount = fineAmount;
    findings.push(finding);
  }
  return findings;
}

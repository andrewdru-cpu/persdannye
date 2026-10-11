import { isLimitedScan } from "./phases";
import type { Finding, FindingSeverity } from "./types";

const SEVERITIES = new Set<FindingSeverity>(["critical", "high", "medium", "low", "info"]);

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

/** Text findings only. `status` is copied only when the parser sent one. */
export function normalizeFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) return [];
  const findings: Finding[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const ruleId = textField(record.rule_id, 80);
    const title = textField(record.title, 300);
    const fact = textField(record.fact, 1000);
    if (!ruleId || !title || !fact) continue;
    const severityRaw = textField(record.severity, 20);
    const severity: FindingSeverity = SEVERITIES.has(severityRaw as FindingSeverity)
      ? (severityRaw as FindingSeverity)
      : "info";
    const finding: Finding = { rule_id: ruleId, title, fact, severity };
    const status = findingStatusToken(record.status);
    if (status) finding.status = status;
    const reason = findingReasonToken(record.reason);
    if (reason) finding.reason = reason;
    findings.push(finding);
  }
  return findings;
}

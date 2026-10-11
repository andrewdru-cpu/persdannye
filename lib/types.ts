import type { ParserPhase } from "./phases";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  rule_id: string;
  title: string;
  fact: string;
  severity: FindingSeverity;
  /**
   * Upcoming parser status. Absent on current scans — those still count
   * as violations. `needs_check` and `not_checked` do not.
   */
  status?: string;
  /**
   * Why a rule was not applied. `robots_disallow` with `not_checked`
   * means the site blocked the crawler; it is not a violation.
   */
  reason?: string;
}

/** Contacts captured on the landing at the moment a scan is created. */
export interface ScanContact {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  consent?: boolean;
  consent_text_version?: string;
}

export interface CheckJob {
  id: string;
  url: string;
  domain: string;
  /** internal scan id from parser when connected */
  scanId?: string;
  phase: ParserPhase | string;
  phaseMessage: string;
  score?: number | null;
  findings: Finding[];
  /**
   * Done scan: at least one legacy finding (no status) or an explicit
   * violation status. `needs_check`, `not_checked`, and unknown statuses
   * do not set this. In progress, follows `push` only.
   */
  hasRisks: boolean;
  /** True when the scan payload set `mode` to `static_fallback`. */
  staticFallback?: boolean;
  /** `rules_version` when the parser sent a non-empty string. */
  rulesVersion?: string | null;
  push?: boolean;
  /** True when parser has a PDF report ready to fetch server-side. */
  pdfReady?: boolean;
  /**
   * Public report URL from POST /public/check (202). The raw /r/{token}
   * exists only inside this URL — keep the URL, do not split the token out.
   */
  reportUrl?: string | null;
  warning?: string | null;
  error?: string | null;
  /** Lead fields supplied with the check, if any. */
  contact?: ScanContact | null;
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  url?: string;
  checkId?: string;
  message?: string;
  consent: boolean;
  createdAt: string;
  source: string;
}

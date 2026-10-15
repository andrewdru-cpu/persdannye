import type { ParserPhase } from "./phases";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface FindingEvidence {
  url?: string;
  selector?: string;
  note?: string;
}

export interface Finding {
  rule_id: string;
  title: string;
  fact: string;
  severity: FindingSeverity;
  /** not_applicable скрываем, not_checked показываем нейтрально. */
  status?: string;
  /** confirmed | likely | interpretation. Чужое значение на экране нейтральное. */
  status_basis?: string;
  /** null — сумму не показываем. Число — только при включённом флаге штрафов. */
  fine?: number | null;
  remediation?: string | null;
  /** Хранится на сервере. В браузер и на экран не попадает. */
  collects_pd?: boolean;
}

export interface Recommendation {
  id: string;
  category?: string;
  title: string;
  text: string;
  evidence?: FindingEvidence[];
  /** Не показываем как счётчик. */
  count?: number;
  priority?: string;
}

/** Contacts captured on the landing at the moment a scan is created. */
export interface ScanContact {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  consent?: boolean;
  consent_text_version?: string;
  marketing_consent?: boolean;
  marketing_consent_text_version?: string;
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
  recommendations?: Recommendation[];
  /** true if risks for landing: push===true OR a finding that is not info / not_checked / not_applicable */
  hasRisks: boolean;
  push?: boolean;
  /** True when parser has a PDF report ready to fetch server-side. */
  pdfReady?: boolean;
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
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  checkId?: string;
  message?: string;
  consent: boolean;
  consent_text_version?: string;
  marketing_consent?: boolean;
  marketing_consent_text_version?: string;
  createdAt: string;
  source: string;
}

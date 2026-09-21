import type { ParserPhase } from "./phases";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  rule_id: string;
  title: string;
  fact: string;
  severity: FindingSeverity;
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
  /** true if risks for landing: push===true OR findings length > 0 when done */
  hasRisks: boolean;
  push?: boolean;
  warning?: string | null;
  error?: string | null;
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

import { safeHref } from "./safe-href";
import type { CheckJob, Finding, FindingEvidence } from "./types";

/** Та же строка, которой сервер парсера уже закрывает контакты. Второй слой её не переписывает. */
export const CONTACT_MASK = "[контактные данные скрыты]";

/** Спокойная строка, если показывать нечего. Слова «нарушение» в интерфейсе отчёта нет. */
export const CHECK_CLEAR_LINE =
  "В экспресс-проверке таких замечаний не нашли. Разбор юристом может показать дополнительные пункты.";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+|00)?\d[\d\s().-]{8,}\d/g;

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Критично",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  info: "Инфо",
};

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export type EvidenceView = {
  href: string | null;
  selector: string;
  note: string;
};

export type FindingView = {
  key: string;
  ruleId: string;
  title: string;
  fact: string;
  severity: string;
  severityLabel: string;
  basisLabel: string | null;
  statusLabel: string | null;
  remediation: string | null;
  fineLabel: string | null;
  informational: boolean;
};

export type RecommendationView = {
  id: string;
  title: string;
  text: string;
  evidence: EvidenceView[];
};

export type CheckReportView = {
  findings: FindingView[];
  recommendations: RecommendationView[];
  clearLine: string | null;
};

/** Клиентский фильтр контактов: почта и телефон. Уже закрытую сервером строку не трогаем. */
export function maskClientPii(value: string): string {
  if (!value || value === CONTACT_MASK) return value;
  const withoutEmail = value.replace(EMAIL_RE, CONTACT_MASK);
  return withoutEmail.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return match;
    return CONTACT_MASK;
  });
}

function mask(value: string | null | undefined): string {
  if (!value) return "";
  return maskClientPii(value);
}

/** likely и interpretation получают короткие подписи. Чужое значение — нейтральная пометка, без слова «нарушение». */
export function basisLabel(basis: string | null | undefined): string | null {
  if (!basis || basis === "confirmed") return null;
  if (basis === "likely") return "вероятно";
  if (basis === "interpretation") return "наше толкование";
  return "без уточнения";
}

export function findingCountsAsRisk(finding: Finding): boolean {
  if (finding.status === "not_applicable" || finding.status === "not_checked") return false;
  if (finding.severity === "info") return false;
  return true;
}

export function scanHasRisks(done: boolean, push: boolean, findings: Finding[]): boolean {
  if (!done) return push;
  return push || findings.some(findingCountsAsRisk);
}

/** В браузер collects_pd не отдаём: поле хранится на сервере и на экран не выводится. */
export function findingsForClient(findings: Finding[]): Finding[] {
  return findings.map((finding) => {
    if (!("collects_pd" in finding)) return finding;
    const copy = { ...finding };
    delete copy.collects_pd;
    return copy;
  });
}

function fineLabel(finding: Finding, showFines: boolean): string | null {
  if (!showFines) return null;
  if (finding.severity === "info") return null;
  if (finding.status === "not_applicable") return null;
  if (finding.fine == null) return null;
  if (typeof finding.fine !== "number" || !Number.isFinite(finding.fine)) return null;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(finding.fine);
}

function priorityRank(priority: string | undefined): number {
  if (!priority) return 3;
  return PRIORITY_RANK[priority] ?? 3;
}

function presentEvidence(item: FindingEvidence): EvidenceView {
  return {
    href: safeHref(item.url ? maskClientPii(item.url) : item.url),
    selector: mask(item.selector),
    note: mask(item.note),
  };
}

/**
 * Вид отчёта для экрана /check.
 * not_applicable скрыт. not_checked остаётся с подписью «не удалось проверить».
 * Сумма — только при включённом флаге штрафов, не для info и не при fine: null.
 * count рекомендации на экран не попадает.
 */
export function presentCheckReport(
  job: Pick<CheckJob, "findings" | "recommendations">,
  options: { showFines: boolean }
): CheckReportView {
  const findings = (job.findings ?? [])
    .filter((finding) => finding.status !== "not_applicable")
    .map((finding, index): FindingView => {
      const remediation = finding.remediation?.trim() ? mask(finding.remediation) : "";
      return {
        key: `${finding.rule_id}:${index}`,
        ruleId: finding.rule_id,
        title: mask(finding.title),
        fact: mask(finding.fact),
        severity: finding.severity,
        severityLabel: SEVERITY_LABEL[finding.severity] || finding.severity,
        basisLabel: basisLabel(finding.status_basis),
        statusLabel: finding.status === "not_checked" ? "не удалось проверить" : null,
        remediation: remediation || null,
        fineLabel: fineLabel(finding, options.showFines),
        informational: finding.severity === "info",
      };
    });

  const recommendations = [...(job.recommendations ?? [])]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .map((item): RecommendationView => ({
      id: item.id,
      title: mask(item.title),
      text: mask(item.text),
      evidence: (item.evidence ?? []).map((entry) => presentEvidence(entry)),
    }));

  return {
    findings,
    recommendations,
    clearLine: findings.length === 0 ? CHECK_CLEAR_LINE : null,
  };
}

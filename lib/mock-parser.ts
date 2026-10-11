import { jobHasRisks, normalizeFindings } from "./finding-status";
import type { CheckJob, Finding } from "./types";
import { friendlyPhaseMessage, LIMITED_SCAN_MESSAGE, phaseIndex, PHASE_STEPS } from "./phases";
import { domainFromUrl } from "./utils";

const MOCK_FINDINGS: Finding[] = [
  {
    rule_id: "P01",
    title: "Отсутствует политика обработки ПДн",
    fact: "На сайте не найдена политика / документ с обязательными сведениями по ст. 18.1 152-ФЗ.",
    severity: "critical",
  },
  {
    rule_id: "C02",
    title: "Cookie без раздельного согласия",
    fact: "Аналитические и маркетинговые cookie включаются до получения согласия пользователя.",
    severity: "high",
  },
  {
    rule_id: "F03",
    title: "Форма без явного согласия",
    fact: "Лид-форма отправляет ПДн без отдельной отметки согласия на обработку.",
    severity: "high",
  },
  {
    rule_id: "T04",
    title: "Нет сведений об операторе",
    fact: "В подвале / политике не указаны наименование, ИНН/ОГРН и контакты оператора.",
    severity: "medium",
  },
];

const REVIEW_FINDINGS: Finding[] = [
  {
    rule_id: "F08",
    title: "Форма обратной связи",
    fact: "Текст согласия на форме нужно сверить вручную.",
    severity: "critical",
    status: "needs_check",
  },
  {
    rule_id: "C11",
    title: "Сторонний виджет",
    fact: "Скрипт не открылся, правило не применялось.",
    severity: "high",
    status: "not_checked",
  },
];

const PARTIAL_FINDINGS: Finding[] = [
  {
    rule_id: "P01",
    title: "Нет политики обработки ПДн",
    fact: "Документ по ст. 18.1 не найден.",
    severity: "high",
    status: "violation",
  },
  {
    rule_id: "F08",
    title: "Форма обратной связи",
    fact: "Текст согласия на форме нужно сверить вручную.",
    severity: "critical",
    status: "needs_check",
  },
  {
    rule_id: "C11",
    title: "Сторонний виджет",
    fact: "Скрипт не открылся, правило не применялось.",
    severity: "medium",
    status: "not_checked",
  },
  {
    rule_id: "X99",
    title: "Новое правило",
    fact: "Статус ещё не описан в контракте.",
    severity: "high",
    status: "later_added",
  },
];

/** Raw GET /public/check shape: Disallow: / is a partial result, not blocked_by_robots. */
const ROBOTS_PARTIAL_RAW = [
  {
    rule_id: "H01",
    title: "Главная страница",
    fact: "На главной нет ссылки на политику обработки ПДн.",
    severity: "S",
    status: "violation",
    status_basis: "proven",
    fine_norm: "ч. 3 ст. 13.11 КоАП",
    fine_interpretation: false,
    fine_amount_text: null,
    meta: { disclaimer: "Проверены главная страница и документ политики." },
  },
  {
    rule_id: "P01",
    title: "Политика обработки ПДн",
    fact: "В политике не указан срок обработки.",
    severity: "B",
    status: "violation",
    status_basis: "likely",
    fine_norm: "ч. 3 ст. 13.11 КоАП",
    fine_interpretation: true,
    fine_amount_text: "до 300 000 ₽",
    meta: { disclaimer: "Квалификацию этой формулировки оценивает юрист." },
  },
  {
    rule_id: "F03",
    title: "Формы на внутренних страницах",
    fact: "Страницы не открывались: robots.txt содержит Disallow: /.",
    severity: "A",
    status: "not_checked",
    reason: "robots_disallow",
    fine_norm: "ч. 2 ст. 13.11 КоАП",
  },
  {
    rule_id: "C02",
    title: "Cookie на внутренних страницах",
    fact: "Правило не применялось, обход остальных страниц запрещён.",
    severity: "low",
    status: "not_checked",
    reason: "robots_disallow",
  },
];

type MockState = {
  createdAt: number;
  url: string;
  domain: string;
  variant: "risks" | "ok" | "blocked" | "partial" | "review" | "robots" | "siteblock";
};

const mockJobs = new Map<string, MockState>();

function pickVariant(url: string): MockState["variant"] {
  const host = domainFromUrl(url).toLowerCase();
  if (host.includes("robots") || host.includes("disallow")) return "robots";
  if (host.includes("siteblock")) return "siteblock";
  if (host.includes("blocked") || host.includes("fail")) return "blocked";
  if (host.includes("partial") || host.includes("fallback")) return "partial";
  if (host.includes("review")) return "review";
  if (host.includes("ok") || host.includes("compliant")) return "ok";
  return "risks";
}

export function mockCreateScan(id: string, url: string): void {
  mockJobs.set(id, {
    createdAt: Date.now(),
    url,
    domain: domainFromUrl(url),
    variant: pickVariant(url),
  });
}

export function mockGetScan(id: string): CheckJob | null {
  const state = mockJobs.get(id);
  if (!state) return null;

  const elapsed = Date.now() - state.createdAt;
  const stepMs = 1500;
  const domain = state.domain;

  if (state.variant === "blocked" && elapsed > stepMs * 1.5) {
    return {
      id,
      url: state.url,
      domain,
      phase: "blocked",
      phaseMessage: friendlyPhaseMessage("blocked", domain),
      score: null,
      findings: [],
      hasRisks: true,
      error: "Сайт недоступен или блокирует автоматическую проверку",
      createdAt: new Date(state.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      mock: true,
    };
  }

  const step = Math.min(
    PHASE_STEPS.length,
    Math.floor(elapsed / stepMs)
  );

  if (step >= PHASE_STEPS.length && state.variant === "robots") {
    const findings = normalizeFindings(ROBOTS_PARTIAL_RAW);
    return {
      id,
      url: state.url,
      domain,
      phase: "done",
      phaseMessage: friendlyPhaseMessage("done", domain),
      score: 64,
      findings,
      hasRisks: jobHasRisks({ phase: "done", push: false, findings }),
      staticFallback: true,
      rulesVersion: "2026.10",
      error: null,
      pdfReady: false,
      createdAt: new Date(state.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      mock: true,
    };
  }

  if (step >= PHASE_STEPS.length && state.variant === "siteblock") {
    return {
      id,
      url: state.url,
      domain,
      phase: "blocked_by_site",
      phaseMessage: LIMITED_SCAN_MESSAGE,
      score: null,
      findings: [],
      hasRisks: false,
      staticFallback: false,
      rulesVersion: null,
      error: null,
      pdfReady: false,
      createdAt: new Date(state.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      mock: true,
    };
  }

  if (step >= PHASE_STEPS.length) {
    const findings =
      state.variant === "ok"
        ? []
        : state.variant === "partial"
          ? PARTIAL_FINDINGS
          : state.variant === "review"
            ? REVIEW_FINDINGS
            : MOCK_FINDINGS;
    const score = state.variant === "ok" ? 96 : state.variant === "partial" ? 71 : state.variant === "review" ? 90 : 42;
    const partialNotice = state.variant === "partial" || state.variant === "review";
    return {
      id,
      url: state.url,
      domain,
      phase: "done",
      phaseMessage: friendlyPhaseMessage("done", domain),
      score,
      findings,
      hasRisks: jobHasRisks({ phase: "done", push: state.variant === "risks", findings }),
      push: state.variant === "risks",
      staticFallback: partialNotice,
      rulesVersion: partialNotice ? "2026.10" : null,
      pdfReady: false,
      createdAt: new Date(state.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      mock: true,
    };
  }

  const phase = PHASE_STEPS[step].id;
  return {
    id,
    url: state.url,
    domain,
    phase,
    phaseMessage: friendlyPhaseMessage(phase, domain),
    score: null,
    findings: [],
    hasRisks: false,
    createdAt: new Date(state.createdAt).toISOString(),
    updatedAt: new Date().toISOString(),
    mock: true,
  };
}

export function mockProgressPercent(phase: string): number {
  if (phase === "done") return 100;
  if (phase === "error" || phase === "blocked") return 100;
  const i = phaseIndex(phase);
  if (i < 0) return 0;
  return Math.round(((i + 1) / (PHASE_STEPS.length + 1)) * 100);
}

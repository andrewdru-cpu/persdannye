import type { CheckJob, Finding, Recommendation } from "./types";
import { friendlyPhaseMessage, phaseIndex, PHASE_STEPS } from "./phases";
import { domainFromUrl } from "./utils";
import { findingCountsAsRisk, scanHasRisks } from "./check-report";

const MOCK_FINDINGS: Finding[] = [
  {
    rule_id: "P01",
    title: "Отсутствует политика обработки ПДн",
    fact: "На сайте не найден документ со сведениями по ст. 18.1 152-ФЗ.",
    severity: "critical",
    status: "fail",
    status_basis: "confirmed",
    fine: 150000,
    remediation: "Опубликуйте политику и ссылку на неё с каждой страницы.",
    collects_pd: true,
  },
  {
    rule_id: "C02",
    title: "Cookie без раздельного согласия",
    fact: "Аналитические cookie включаются до выбора пользователя.",
    severity: "high",
    status: "fail",
    status_basis: "likely",
    fine: null,
    remediation: "Держите аналитику выключенной, пока человек не примет её.",
  },
  {
    rule_id: "F03",
    title: "Форма без отдельной отметки",
    fact: "Поле согласия не отделено от отправки формы.",
    severity: "high",
    status: "fail",
    status_basis: "interpretation",
    fine: null,
  },
  {
    rule_id: "I05",
    title: "Справочная отметка о счётчике",
    fact: "На странице есть упоминание счётчика. Это справочная строка.",
    severity: "info",
    status: "info",
    status_basis: "confirmed",
    fine: 50000,
  },
  {
    rule_id: "N06",
    title: "Блок не открылся",
    fact: "Страница отдала ошибку, пункт остался без результата.",
    severity: "medium",
    status: "not_checked",
    status_basis: "confirmed",
    fine: 10000,
  },
  {
    rule_id: "X07",
    title: "Пункт к этому сайту не относится",
    fact: "Правило про витрину комиссий на этом типе сайта не применяется.",
    severity: "low",
    status: "not_applicable",
    status_basis: "confirmed",
    fine: 1000,
    collects_pd: false,
  },
  {
    rule_id: "U08",
    title: "Незнакомая пометка источника",
    fact: "Источник прислал основание, которого нет в списке.",
    severity: "low",
    status: "fail",
    status_basis: "needs_review",
    fine: null,
  },
];

const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "r-low",
    category: "docs",
    title: "Уточнить подпись у формы",
    text: "Короткая подпись рядом с полем. Письмо на ivan@example.ru не копируйте в отчёт.",
    evidence: [
      { url: "https://example.com/form", selector: "form .hint", note: "Черновик: +7 (999) 111-22-33" },
    ],
    count: 2,
    priority: "low",
  },
  {
    id: "r-high",
    category: "policy",
    title: "Добавить ссылку на политику",
    text: "Ссылка в подвале на опубликованный документ.",
    evidence: [{ url: "https://example.com/", selector: "footer", note: "[контактные данные скрыты]" }],
    count: 5,
    priority: "high",
  },
  {
    id: "r-unknown",
    category: "other",
    title: "Проверить вложение",
    text: "Файл политики не разобран.",
    priority: "urgent",
    count: 1,
    evidence: [],
  },
  {
    id: "r-med",
    category: "cookie",
    title: "Разделить категории cookie",
    text: "Необходимые cookie оставьте, остальные — по выбору.",
    priority: "medium",
    count: 3,
    evidence: [{ selector: "input[name=email]", note: "owner@site.ru" }],
  },
];

type MockState = {
  createdAt: number;
  url: string;
  domain: string;
  variant: "risks" | "ok" | "blocked";
};

const mockJobs = new Map<string, MockState>();

function pickVariant(url: string): MockState["variant"] {
  const host = domainFromUrl(url).toLowerCase();
  if (host.includes("blocked") || host.includes("fail")) return "blocked";
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

  if (step >= PHASE_STEPS.length) {
    const findings = state.variant === "ok" ? [] : MOCK_FINDINGS;
    const recommendations = state.variant === "ok" ? [] : MOCK_RECOMMENDATIONS;
    const score = state.variant === "ok" ? 96 : 42;
    const risky = findings.some(findingCountsAsRisk);
    return {
      id,
      url: state.url,
      domain,
      phase: "done",
      phaseMessage: friendlyPhaseMessage("done", domain),
      score,
      findings,
      recommendations,
      hasRisks: scanHasRisks(true, risky, findings),
      push: risky,
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

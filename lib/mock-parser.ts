import type { CheckJob, Finding } from "./types";
import { friendlyPhaseMessage, phaseIndex, PHASE_STEPS } from "./phases";
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
    const score = state.variant === "ok" ? 96 : 42;
    return {
      id,
      url: state.url,
      domain,
      phase: "done",
      phaseMessage: friendlyPhaseMessage("done", domain),
      score,
      findings,
      hasRisks: findings.length > 0,
      push: findings.length > 0,
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

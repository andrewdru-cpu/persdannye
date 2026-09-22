/** Маппинг фаз парсера → дружелюбные русские шаги UI */
export type ParserPhase =
  | "queued"
  | "open"
  | "extract"
  | "rules"
  | "pdf"
  | "done"
  | "error"
  | "blocked";

/** How often the landing polls an in-progress scan. */
export const ACTIVE_POLL_MS = 1500;

export const PHASE_STEPS: {
  id: ParserPhase;
  label: string;
  description: string;
  /** Typical duration shown while the step is active. */
  eta: string;
}[] = [
  {
    id: "queued",
    label: "В очереди",
    description: "Задача принята, ждём свободный воркер",
    eta: "1–2 с",
  },
  {
    id: "open",
    label: "Открываем сайт",
    description: "Загружаем страницы и cookie-баннеры",
    eta: "3–8 с",
  },
  {
    id: "extract",
    label: "Извлекаем данные",
    description: "Собираем формы, политики, скрипты и согласия",
    eta: "4–10 с",
  },
  {
    id: "rules",
    label: "Проверяем правила 152-ФЗ",
    description: "Сверяем с актуальной базой требований РКН",
    eta: "3–8 с",
  },
  {
    id: "pdf",
    label: "Формируем отчёт",
    description: "Готовим сводку нарушений и рекомендаций",
    eta: "2–6 с",
  },
];

export const TERMINAL_PHASES: ParserPhase[] = ["done", "error", "blocked"];

const PHASE_ALIASES: Record<string, ParserPhase> = {
  queued: "queued",
  pending: "queued",
  created: "queued",
  new: "queued",
  waiting: "queued",
  open: "open",
  opening: "open",
  fetch: "open",
  fetching: "open",
  crawl: "open",
  crawling: "open",
  browse: "open",
  browsing: "open",
  extract: "extract",
  extracting: "extract",
  parse: "extract",
  parsing: "extract",
  analyze: "extract",
  analyzing: "extract",
  rules: "rules",
  checking: "rules",
  scoring: "rules",
  score: "rules",
  pdf: "pdf",
  report: "pdf",
  rendering: "pdf",
  render: "pdf",
  done: "done",
  complete: "done",
  completed: "done",
  finished: "done",
  success: "done",
  error: "error",
  failed: "error",
  fail: "error",
  blocked: "blocked",
  unavailable: "blocked",
};

/** Map upstream phase names onto queued|open|extract|rules|pdf (+ terminal). */
export function normalizePhase(raw: string | null | undefined): ParserPhase | string {
  if (!raw) return "queued";
  const key = String(raw).trim().toLowerCase();
  return PHASE_ALIASES[key] || raw;
}

export function isTerminal(phase: string): boolean {
  return TERMINAL_PHASES.includes(normalizePhase(phase) as ParserPhase);
}

export function phaseIndex(phase: string): number {
  const i = PHASE_STEPS.findIndex((s) => s.id === phase);
  if (phase === "done") return PHASE_STEPS.length;
  if (phase === "error" || phase === "blocked") return -1;
  return i < 0 ? 0 : i;
}

export function friendlyPhaseMessage(
  phase: string,
  domain: string,
  backendMessage?: string | null
): string {
  if (backendMessage) return backendMessage;
  switch (phase) {
    case "queued":
      return `Ставим ${domain} в очередь проверки…`;
    case "open":
      return `Открываем ${domain}…`;
    case "extract":
      return `Анализируем структуру ${domain}…`;
    case "rules":
      return `Сверяем ${domain} с требованиями 152-ФЗ…`;
    case "pdf":
      return `Готовим отчёт по ${domain}…`;
    case "done":
      return `Проверка ${domain} завершена`;
    case "error":
      return `Не удалось завершить проверку ${domain}`;
    case "blocked":
      return `Доступ к ${domain} ограничен или сайт недоступен`;
    default:
      return `Проверяем ${domain}…`;
  }
}

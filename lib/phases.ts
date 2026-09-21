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

export const PHASE_STEPS: {
  id: ParserPhase;
  label: string;
  description: string;
}[] = [
  {
    id: "queued",
    label: "В очереди",
    description: "Задача принята, ждём свободный воркер",
  },
  {
    id: "open",
    label: "Открываем сайт",
    description: "Загружаем страницы и cookie-баннеры",
  },
  {
    id: "extract",
    label: "Извлекаем данные",
    description: "Собираем формы, политики, скрипты и согласия",
  },
  {
    id: "rules",
    label: "Проверяем правила 152-ФЗ",
    description: "Сверяем с актуальной базой требований РКН",
  },
  {
    id: "pdf",
    label: "Формируем отчёт",
    description: "Готовим сводку нарушений и рекомендаций",
  },
];

export const TERMINAL_PHASES: ParserPhase[] = ["done", "error", "blocked"];

export function isTerminal(phase: string): boolean {
  return TERMINAL_PHASES.includes(phase as ParserPhase);
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

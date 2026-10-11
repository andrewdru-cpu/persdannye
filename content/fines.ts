/**
 * Справочник ст. 13.11 КоАП РФ.
 * Суммы: приложение B, сверено 11.10.2026 с КонсультантПлюс и ГАРАНТ.
 *
 * На сайт цифры попадают только если одновременно:
 * 1) `approved === true`;
 * 2) `NEXT_PUBLIC_SHOW_FINES=true` на сборке.
 *
 * Пока `approved: false`, даже с флагом показывается нейтральная фраза без цифр.
 * Не импортировать из клиентских компонентов — калькулятор получает поля пропсами.
 */

export type RubleRange = {
  min: number;
  max: number;
  /** Подпись для таблицы. */
  label: string;
};

export type StatusBasis = "proven" | "likely";

export type FineRow = {
  id: string;
  violation: string;
  ip: RubleRange;
  legal: RubleRange;
  norm: string;
  status_basis: StatusBasis;
};

export type CalculatorIssue = {
  id: string;
  label: string;
  /** Короткое пояснение. Для likely дублируется стандартная пометка. */
  hint: string;
  rowId: string;
};

const rub = (min: number, max: number, label: string): RubleRange => ({ min, max, label });

export const finesCatalog = {
  /**
   * Публикация сумм. Юрист включает true отдельным изменением.
   * Тип boolean нарочно широкий, чтобы ветка с суммами оставалась в коде.
   */
  approved: false as boolean,
  as_of: "11.10.2026",
  source: "ст. 13.11 КоАП РФ",
  article: "ст. 13.11 КоАП РФ",
  caption: "По состоянию на 11.10.2026, КоАП РФ в ред. от 04.08.2026",
  likelyNote: "вероятная квалификация, оценивает юрист",
  footnote: "ИП по ч. 1.1 и 8–18 отвечают как юрлица (прим. 1 к ст. 13.11).",
  rows: [
    {
      id: "processing-unlawful",
      violation:
        "Обработка ПДн в случаях, не предусмотренных законом (в т.ч. форма без надлежащего согласия)",
      ip: rub(50_000, 100_000, "50–100 тыс. ₽"),
      legal: rub(150_000, 300_000, "150–300 тыс. ₽"),
      norm: "ч. 1",
      status_basis: "likely",
    },
    {
      id: "repeat-processing-unlawful",
      violation: "Повторно по ч. 1",
      ip: rub(300_000, 500_000, "300–500 тыс. ₽"),
      legal: rub(300_000, 500_000, "300–500 тыс. ₽"),
      norm: "ч. 1.1",
      status_basis: "proven",
    },
    {
      id: "no-written-consent",
      violation: "Обработка без письменного согласия, где оно обязательно",
      ip: rub(100_000, 300_000, "100–300 тыс. ₽"),
      legal: rub(300_000, 700_000, "300–700 тыс. ₽"),
      norm: "ч. 2",
      status_basis: "proven",
    },
    {
      id: "repeat-no-written-consent",
      violation: "Повторно по ч. 2",
      ip: rub(500_000, 1_000_000, "500 тыс.–1 млн ₽"),
      legal: rub(1_000_000, 1_500_000, "1–1,5 млн ₽"),
      norm: "ч. 2.1",
      status_basis: "proven",
    },
    {
      id: "no-policy",
      violation: "Нет политики обработки ПДн на сайте",
      ip: rub(10_000, 20_000, "10–20 тыс. ₽"),
      legal: rub(30_000, 60_000, "30–60 тыс. ₽"),
      norm: "ч. 3",
      status_basis: "proven",
    },
    {
      id: "no-rkn-notice",
      violation: "Нет уведомления РКН об обработке ПДн",
      ip: rub(100_000, 300_000, "100–300 тыс. ₽"),
      legal: rub(100_000, 300_000, "100–300 тыс. ₽"),
      norm: "ч. 10",
      status_basis: "proven",
    },
    {
      id: "cross-border",
      violation: "Иностранные трекеры и сервисы (трансграничная передача)",
      ip: rub(50_000, 100_000, "50–100 тыс. ₽"),
      legal: rub(150_000, 300_000, "150–300 тыс. ₽"),
      norm: "ч. 1 (ориентир)",
      status_basis: "likely",
    },
    {
      id: "localization",
      violation: "Запись и хранение ПДн граждан РФ вне России (локализация)",
      ip: rub(1_000_000, 6_000_000, "1–6 млн ₽"),
      legal: rub(1_000_000, 6_000_000, "1–6 млн ₽"),
      norm: "ч. 8",
      status_basis: "proven",
    },
    {
      id: "repeat-localization",
      violation: "Повторно по ч. 8",
      ip: rub(6_000_000, 18_000_000, "6–18 млн ₽"),
      legal: rub(6_000_000, 18_000_000, "6–18 млн ₽"),
      norm: "ч. 9",
      status_basis: "proven",
    },
    {
      id: "leak-notice",
      violation: "Неуведомление РКН об утечке",
      ip: rub(1_000_000, 3_000_000, "1–3 млн ₽"),
      legal: rub(1_000_000, 3_000_000, "1–3 млн ₽"),
      norm: "ч. 11",
      status_basis: "proven",
    },
    {
      id: "leak-scale",
      violation: "Утечка ПДн (по масштабу)",
      ip: rub(3_000_000, 15_000_000, "3–5 / 5–10 / 10–15 млн ₽"),
      legal: rub(3_000_000, 15_000_000, "3–5 / 5–10 / 10–15 млн ₽"),
      norm: "ч. 12–14",
      status_basis: "proven",
    },
    {
      id: "leak-special",
      violation: "Утечка спецкатегорий",
      ip: rub(10_000_000, 15_000_000, "10–15 млн ₽"),
      legal: rub(10_000_000, 15_000_000, "10–15 млн ₽"),
      norm: "ч. 16",
      status_basis: "proven",
    },
    {
      id: "leak-biometric",
      violation: "Утечка биометрии",
      ip: rub(15_000_000, 20_000_000, "15–20 млн ₽"),
      legal: rub(15_000_000, 20_000_000, "15–20 млн ₽"),
      norm: "ч. 17",
      status_basis: "proven",
    },
  ] satisfies FineRow[],
  /**
   * Не строка таблицы: процент от выручки.
   * На шкалу фиксированных вилок не кладём.
   */
  turnover: {
    title: "Повторная утечка",
    text: "Повторная утечка — 1–3% выручки: по ч. 15 (повтор ч. 12–14) не менее 20 млн и не более 500 млн ₽; по ч. 18 (повтор ч. 16–17) не менее 25 млн и не более 500 млн ₽.",
    minPercent: 1,
    maxPercent: 3,
    parts: [
      { norm: "ч. 15", repeats: "ч. 12–14", minRub: 20_000_000, maxRub: 500_000_000 },
      { norm: "ч. 18", repeats: "ч. 16–17", minRub: 25_000_000, maxRub: 500_000_000 },
    ],
  },
  calculatorExcludedNote:
    "Утечки и оборотный штраф в сумму не входят: по публичным страницам их не видно. Оборотный штраф указан в блоке выше.",
  calculatorIssues: [
    {
      id: "no-policy",
      label: "Нет политики обработки ПДн на сайте",
      hint: "Политика обработки персональных данных на сайте не опубликована.",
      rowId: "no-policy",
    },
    {
      id: "form-without-consent",
      label: "Форма без надлежащего согласия",
      hint: "Заявка или другая форма собирает данные без согласия в том виде, как этого требует закон.",
      rowId: "processing-unlawful",
    },
    {
      id: "foreign-trackers",
      label: "Иностранные трекеры и сервисы",
      hint: "На страницах стоят счётчики или пиксели, которые передают данные за пределы России.",
      rowId: "cross-border",
    },
    {
      id: "no-rkn-notice",
      label: "Нет уведомления РКН об обработке ПДн",
      hint: "Уведомление об обработке персональных данных в Роскомнадзор не подано.",
      rowId: "no-rkn-notice",
    },
    {
      id: "foreign-storage",
      label: "Форма или чат пишет данные в зарубежную CRM или базу",
      hint: "Заявка или чат сохраняет персональные данные граждан РФ за пределами России.",
      rowId: "localization",
    },
  ] satisfies CalculatorIssue[],
};

export type BusinessKind = "ip" | "legal";

export type CalculatorIssueView = {
  id: string;
  label: string;
  hint: string;
  norm: string;
  likely: boolean;
  ip: { min: number; max: number };
  legal: { min: number; max: number };
};

function rangePair(range: RubleRange) {
  return { min: range.min, max: range.max };
}

export function calculatorIssueViews(
  catalog: typeof finesCatalog = finesCatalog,
): CalculatorIssueView[] {
  return catalog.calculatorIssues.map((issue) => {
    const row = catalog.rows.find((item) => item.id === issue.rowId);
    if (!row) {
      throw new Error(`fines: нет строки ${issue.rowId}`);
    }
    return {
      id: issue.id,
      label: issue.label,
      hint: issue.hint,
      norm: row.norm,
      likely: row.status_basis === "likely",
      ip: rangePair(row.ip),
      legal: rangePair(row.legal),
    };
  });
}

/**
 * DRAFT. Суммы из ТЗ v1.0, раздел 4. Юрист не проверял.
 *
 * На сайт цифры попадают только если одновременно:
 * 1) `approved === true` (этот файл, после правки юриста);
 * 2) `NEXT_PUBLIC_SHOW_FINES=true` на сборке.
 *
 * Пока `approved: false`, даже с флагом показывается нейтральная фраза без цифр.
 * Не импортировать из клиентских компонентов — калькулятор получает уже
 * посчитанные поля пропсами с сервера.
 */

export type RubleRange = {
  min: number;
  max: number;
  /** Подпись как в ТЗ, для таблицы. */
  label: string;
};

export type FineRow = {
  id: string;
  /** Понятная формулировка для собственника. */
  violation: string;
  ip: RubleRange;
  legal: RubleRange;
  /** Колонка «Норма». */
  norm: string;
  /**
   * В ТЗ один диапазон без дроби «ИП / юрлицо».
   * Оба столбца заполнены одинаково, пока юрист не разведёт.
   */
  unsplitInSpec?: boolean;
};

export type CalculatorIssue = {
  id: string;
  label: string;
  hint: string;
  rowId: string;
  /** Если задано и пользователь отметил «повторное», берём эту строку вместо rowId. */
  repeatRowId?: string;
};

const rub = (min: number, max: number, label: string): RubleRange => ({ min, max, label });

export const finesCatalog = {
  /**
   * Юрист ставит true только после проверки каждой строки.
   * Тип boolean нарочно широкий, чтобы ветка с суммами оставалась в коде.
   */
  approved: false as boolean,
  draft: true,
  as_of: "2026-10-11",
  source: "ТЗ v1.0, раздел 4 (черновик, суммы не проверены юристом)",
  article: "ст. 13.11 КоАП РФ",
  rows: [
    {
      id: "no-consent",
      violation: "Обработка персональных данных без согласия",
      ip: rub(100_000, 300_000, "100–300 тыс. ₽"),
      legal: rub(300_000, 700_000, "300–700 тыс. ₽"),
      norm: "ч. 2 ст. 13.11",
    },
    {
      id: "repeat-no-consent",
      violation: "Повторная обработка без согласия",
      ip: rub(500_000, 1_000_000, "500 тыс.–1 млн ₽"),
      legal: rub(1_000_000, 1_500_000, "1–1,5 млн ₽"),
      norm: "ч. 2.1 ст. 13.11",
    },
    {
      id: "no-policy",
      violation: "Не размещена политика обработки ПДн",
      ip: rub(10_000, 20_000, "10–20 тыс. ₽"),
      legal: rub(30_000, 60_000, "30–60 тыс. ₽"),
      norm: "ч. 3 ст. 13.11",
    },
    {
      id: "no-rkn-notice",
      violation: "Неуведомление Роскомнадзора об обработке ПДн",
      ip: rub(100_000, 300_000, "100–300 тыс. ₽"),
      legal: rub(100_000, 300_000, "100–300 тыс. ₽"),
      norm: "ч. 10 ст. 13.11",
      unsplitInSpec: true,
    },
    {
      id: "localization",
      violation: "Нарушение требований о локализации ПДн",
      ip: rub(1_000_000, 6_000_000, "1–6 млн ₽"),
      legal: rub(1_000_000, 6_000_000, "1–6 млн ₽"),
      norm: "ч. 8 ст. 13.11",
      unsplitInSpec: true,
    },
    {
      id: "repeat-localization",
      violation: "Повторное нарушение требований о локализации",
      ip: rub(6_000_000, 18_000_000, "6–18 млн ₽"),
      legal: rub(6_000_000, 18_000_000, "6–18 млн ₽"),
      norm: "ч. 9 ст. 13.11",
      unsplitInSpec: true,
    },
    {
      id: "leak",
      violation: "Утечка персональных данных",
      ip: rub(3_000_000, 20_000_000, "3–20 млн ₽"),
      legal: rub(3_000_000, 20_000_000, "3–20 млн ₽"),
      norm: "ч. 12–14 ст. 13.11",
      unsplitInSpec: true,
    },
  ] satisfies FineRow[],
  /**
   * Не строка таблицы: другая формула, от выручки.
   * На шкалу рядом с фиксированными вилками не кладём.
   */
  turnover: {
    title: "Повторные утечки",
    text: "За повторную утечку закон предусматривает оборотный штраф: 1–3% выручки, но не меньше 20 млн ₽ и не больше 500 млн ₽.",
    minPercent: 1,
    maxPercent: 3,
    minRub: 20_000_000,
    maxRub: 500_000_000,
  },
  calculatorExcludedNote:
    "Оборотный штраф за повторную утечку (1–3% выручки, от 20 млн до 500 млн ₽) в сумму калькулятора не входит: для него нужна выручка.",
  calculatorIssues: [
    {
      id: "no-policy",
      label: "Нет политики обработки ПДн",
      hint: "Политика не опубликована или в ней нет обязательных сведений.",
      rowId: "no-policy",
    },
    {
      id: "form-without-consent",
      label: "Форма без согласия",
      hint: "Заявка, подписка или звонок без отдельного согласия на обработку.",
      rowId: "no-consent",
      repeatRowId: "repeat-no-consent",
    },
    {
      id: "foreign-trackers",
      label: "Иностранные трекеры",
      hint: "Черновик сопоставления: счётчики и пиксели вне РФ отнесены к локализации. Юрист заменит норму, если это другая статья.",
      rowId: "localization",
      repeatRowId: "repeat-localization",
    },
    {
      id: "no-rkn-notice",
      label: "Нет уведомления в Роскомнадзор",
      hint: "Уведомление об обработке персональных данных не подавалось.",
      rowId: "no-rkn-notice",
    },
    {
      id: "leak",
      label: "Утечка персональных данных",
      hint: "Фиксированная вилка. Оборотный штраф за повтор считается отдельно и в сумму не входит.",
      rowId: "leak",
    },
  ] satisfies CalculatorIssue[],
};

export type BusinessKind = "ip" | "legal";

export type CalculatorIssueView = {
  id: string;
  label: string;
  hint: string;
  norm: string;
  ip: { min: number; max: number };
  legal: { min: number; max: number };
  repeat: {
    norm: string;
    ip: { min: number; max: number };
    legal: { min: number; max: number };
  } | null;
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
    const repeatRow = issue.repeatRowId
      ? catalog.rows.find((item) => item.id === issue.repeatRowId)
      : undefined;
    if (issue.repeatRowId && !repeatRow) {
      throw new Error(`fines: нет строки повтора ${issue.repeatRowId}`);
    }
    return {
      id: issue.id,
      label: issue.label,
      hint: issue.hint,
      norm: row.norm,
      ip: rangePair(row.ip),
      legal: rangePair(row.legal),
      repeat: repeatRow
        ? {
            norm: repeatRow.norm,
            ip: rangePair(repeatRow.ip),
            legal: rangePair(repeatRow.legal),
          }
        : null,
    };
  });
}

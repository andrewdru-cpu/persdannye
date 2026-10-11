/**
 * Калькулятор раздела 3. Тексты без сумм: диапазоны включаются только при show_fines.
 */

export type Tri = "" | "yes" | "no" | "unknown";
export type Owner = "" | "ip" | "legal";
export type Counters = "" | "gated" | "ungated" | "no" | "unknown";

export type CalcAnswers = {
  owner: Owner;
  collects: Tri;
  consentSeparate: Tri;
  special: Tri;
  policy: Tri;
  counters: Counters;
  foreignAnalytics: boolean;
  foreignStorage: boolean;
  foreignNone: boolean;
  foreignUnknown: boolean;
  notice: Tri;
};

export const emptyAnswers: CalcAnswers = {
  owner: "",
  collects: "",
  consentSeparate: "",
  special: "",
  policy: "",
  counters: "",
  foreignAnalytics: false,
  foreignStorage: false,
  foreignNone: false,
  foreignUnknown: false,
  notice: "",
};

export const calculatorCopy = {
  title: "Что из требований может касаться вашего сайта",
  lead: "Шесть коротких вопросов. Это справочный расчёт по вашим ответам, а не проверка сайта.",
  clientOnly: "Ответы калькулятора обрабатываются в вашем браузере и нам не передаются.",
  resultTitle: "По вашим ответам к сайту могут относиться эти пункты",
  unknownLine: "Это покажет проверка сайта",
  noHits:
    "По вашим ответам явных пробелов не видно. Но ответы — не то же самое, что проверка: формы, счётчики и сторонние скрипты бывают незаметны даже владельцу. Проверка покажет, что на сайте на самом деле.",
  manyUnknowns:
    "Это нормально, мало кто помнит, какие скрипты стоят на сайте. Проверка найдёт формы, счётчики и сервисы автоматически.",
  separate:
    "Каждый пункт рассматривается отдельно; суммы не складываются автоматически.",
  footnote:
    "За повторные случаи предусмотрены отдельные части статьи с более высокими суммами (например, ч. 1.1 и ч. 2.1).",
  disclaimer:
    "Справочный расчёт по вашим ответам, а не проверка сайта. Информация носит справочный характер и не является юридической консультацией; размер штрафа определяет орган или суд по обстоятельствам дела. Диапазоны — по ст. 13.11 КоАП РФ в ред. от 04.08.2026. «По нашей оценке» — толкование, а не прямой текст закона.",
  cta: "Проверить сайт и получить план, что исправить",
} as const;

export type CalcCard = {
  id: "policy" | "basis" | "written" | "notice" | "localization";
  title: string;
  paragraphs: string[];
  fixes: string[];
  norm: string;
  neutral?: boolean;
};

const cards = {
  policy: {
    id: "policy",
    title: "Не опубликована политика обработки ПДн.",
    paragraphs: [] as string[],
    fixes: [
      "Что исправить: опубликовать политику и дать на неё ссылку со страниц, где собираются данные (152-ФЗ ст. 18.1 ч. 2).",
    ],
    norm: "ч. 3 ст. 13.11 КоАП",
  },
  basis: {
    id: "basis",
    title: "По нашей оценке, ориентир — ч. 1 ст. 13.11 КоАП.",
    paragraphs: [] as string[],
    fixes: [] as string[],
    norm: "ч. 1 ст. 13.11 КоАП",
  },
  written: {
    id: "written",
    title: "Форма без отдельного согласия.",
    paragraphs: [
      "Если форма собирает сведения, для которых закон требует письменное согласие (например, о здоровье, если вы не медицинская организация), применяется ч. 2. Письменное согласие — это бумага или электронный документ с электронной подписью; галочки на сайте для этого недостаточно (ч. 4 ст. 9 152-ФЗ).",
    ],
    fixes: [
      "Что исправить: отдельная галочка согласия, не отмеченная заранее, со ссылкой на отдельный текст согласия.",
    ],
    norm: "ч. 2 ст. 13.11 КоАП",
  },
  notice: {
    id: "notice",
    title: "Не подано уведомление в РКН.",
    paragraphs: [] as string[],
    fixes: [
      "Что исправить: подать уведомление об обработке ПДн (152-ФЗ ст. 22). Расходы на оператора в связи с рассмотрением уведомления не возлагаются (ч. 5 ст. 22).",
    ],
    norm: "ч. 10 ст. 13.11 КоАП",
  },
  localization: {
    id: "localization",
    title: "Заявки хранятся в иностранном сервисе.",
    paragraphs: [
      "Только если данные из форм или чата сначала записываются в зарубежную базу.",
    ],
    fixes: ["Что исправить: первичная запись в базу на территории РФ (152-ФЗ ст. 18 ч. 5)."],
    norm: "ч. 8 ст. 13.11 КоАП",
    neutral: true,
  },
} as const satisfies Record<string, CalcCard>;

const formBasis =
  "Если для обработки нет другого законного основания (например, данные нужны, чтобы заключить договор по вашей заявке, — п. 5 ч. 1 ст. 6 152-ФЗ), нужно отдельное согласие. По нашей оценке, обычная форма заявки относится к ч. 1.";
const formFix =
  "Что исправить: отдельная галочка согласия, не отмеченная заранее, со ссылкой на отдельный текст согласия.";
const counterText =
  "Отдельного штрафа «за cookie» в КоАП нет. По позиции РКН (письмо от 26.06.2024 № 08-242780) для метрических программ нужно согласие посетителя.";
const counterFix =
  "Что исправить: баннер с выбором, счётчики загружаются только после согласия, сведения о них есть в политике.";
const pixelText =
  "По позиции РКН (для Google Analytics — письмо от 26.06.2024 № 08-242780) это трансграничная передача данных: о ней нужно отдельно уведомить РКН до начала передачи (152-ФЗ ст. 12). Отдельного штрафа за это в КоАП нет.";
const pixelFix =
  "Что исправить: заменить на российские аналоги или подать уведомление, и получить согласие посетителя на счётчики.";

export type CalcView = {
  cards: CalcCard[];
  unknowns: string[];
  clear: boolean;
  manyUnknowns: boolean;
};

function answered(value: string): boolean {
  return value !== "";
}

export function resolveCalculator(answers: CalcAnswers): CalcView {
  const unknowns: string[] = [];
  const basisParagraphs: string[] = [];
  const basisFixes: string[] = [];
  let written = false;
  let policy = false;
  let notice = false;
  let localization = false;

  if (answers.policy === "unknown") unknowns.push("Политика");
  if (answers.policy === "no") policy = true;

  if (answers.collects === "unknown") unknowns.push("Сбор данных");
  if (answers.collects === "yes") {
    if (answers.consentSeparate === "unknown") unknowns.push("Согласие у формы");
    if (answers.special === "unknown") unknowns.push("Особые сведения");
    if (answers.consentSeparate === "no" && answers.special === "yes") written = true;
    if (answers.consentSeparate === "no" && answers.special === "no") {
      basisParagraphs.push(formBasis);
      basisFixes.push(formFix);
    }
  }

  if (answers.counters === "unknown") unknowns.push("Счётчики");
  if (answers.counters === "ungated") {
    basisParagraphs.push(counterText);
    basisFixes.push(counterFix);
  }

  if (answers.foreignUnknown) unknowns.push("Иностранные сервисы");
  if (!answers.foreignUnknown && !answers.foreignNone) {
    if (answers.foreignAnalytics) {
      basisParagraphs.push(pixelText);
      basisFixes.push(pixelFix);
    }
    if (answers.foreignStorage) localization = true;
  }

  const countersOn = answers.counters === "gated" || answers.counters === "ungated";
  if (answers.notice === "unknown") unknowns.push("Уведомление");
  if (answers.notice === "no" && (answers.collects === "yes" || countersOn)) notice = true;

  const result: CalcCard[] = [];
  if (policy) result.push(cards.policy);
  if (written) result.push(cards.written);
  if (basisParagraphs.length > 0) {
    result.push({
      ...cards.basis,
      paragraphs: basisParagraphs,
      fixes: [...new Set(basisFixes)],
    });
  }
  if (notice) result.push(cards.notice);
  if (localization) result.push(cards.localization);

  const started =
    answered(answers.owner) ||
    answered(answers.collects) ||
    answered(answers.policy) ||
    answered(answers.counters) ||
    answered(answers.notice) ||
    answers.foreignAnalytics ||
    answers.foreignStorage ||
    answers.foreignNone ||
    answers.foreignUnknown;

  const complete =
    answered(answers.owner) &&
    answered(answers.collects) &&
    (answers.collects !== "yes" ||
      (answered(answers.consentSeparate) && answered(answers.special))) &&
    answered(answers.policy) &&
    answered(answers.counters) &&
    (answers.foreignNone ||
      answers.foreignUnknown ||
      answers.foreignAnalytics ||
      answers.foreignStorage) &&
    answered(answers.notice);

  return {
    cards: result,
    unknowns,
    clear: started && complete && result.length === 0 && unknowns.length === 0,
    manyUnknowns: unknowns.length >= 3,
  };
}

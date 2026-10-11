import {
  checkGroups,
  checkGroupsTitle,
  checkWorkPoints,
  dataCallouts,
  faqItems,
  footerParagraphs,
  formCopy,
  howSteps,
} from "./blocks";
import { calculatorCopy } from "./calculator";
import { fixWithUs, sampleFinesNote, sampleReport, sampleRulesLine, whoFor } from "./extra-blocks";
import { flags } from "./flags";
import { heroSublineNarrowWithCount, heroSublineWithCount } from "../lib/hero-checks";

/**
 * Тексты лендинга. Это черновик: финал утверждают маркетинг и юрист.
 * Суммы штрафов здесь не хранятся — они в `content/fines.ts`
 * и попадают на страницу только при одобрении.
 *
 * Живой герой — один заголовок. Срок — только при `hero_speed_claim`.
 * Число проверок — только при `hero_checks_count` и целом N ≥ 20 от парсера.
 */

export const disclaimer =
  "Информация носит информационный характер и не является юридической консультацией. Точные суммы зависят от обстоятельств дела.";

export const cta = {
  primary: "Проверить свой сайт",
  sticky: "Проверить сайт",
  stickyHint: "Проверьте сайт на соответствие 152-ФЗ",
  stickyPlaceholder: "ваш-сайт.ru",
  stickyClose: "Закрыть",
} as const;

export const heroChrome = {
  badge: "152-ФЗ",
  kicker: "Для собственника без штатного юриста",
  facts: [
    { k: "URL", v: "достаточно" },
    { k: "план", v: "исправлений" },
    { k: "152-ФЗ", v: "точки контроля" },
  ],
  checkerTitle: "Экспресс-проверка",
  checkerText: "URL достаточно. Статус и находки обновляются по ходу проверки.",
  checkerBadge: "По URL",
} as const;

export const trustItems = [
  {
    k: "URL",
    t: "достаточно",
    d: "Экспресс-скан публичных страниц. Код на сайт ставить не нужно.",
  },
  {
    k: "152-ФЗ",
    t: "контрольные точки",
    d: "Политика, cookie, формы, согласия и сведения об операторе.",
  },
  {
    k: "план",
    t: "исправлений",
    d: "Находки с пояснениями, что поправить на сайте.",
  },
] as const;

export const marqueeItems = [
  "аудит 152-ФЗ",
  "cookie · формы · политики",
  "проверка по URL",
  "без установки кода",
  "список рисков с пояснениями",
  "закрытый контур проверки",
] as const;

export const whatWeCheckLead =
  "Контрольные точки по 152-ФЗ: политика, cookie, формы, согласия и сведения об операторе на публичных страницах.";

export const faqs = [
  {
    q: "Это юридическое заключение?",
    a: "Экспресс-проверка — технический скрининг публичных страниц. Полное юридическое заключение готовит юрист после разбора отчёта.",
  },
  {
    q: "Откуда берутся правила проверки?",
    a: "Скан отмечает типовые точки на публичных страницах: политика, cookie, формы, согласия, сведения об операторе. Это не выгрузка из закрытой базы Роскомнадзора и не замена юристу.",
  },
  {
    q: "Нужен ли доступ в админку сайта?",
    a: "Для экспресс-проверки достаточно публичного URL. Для устранения можем работать с вашей командой или подрядчиком.",
  },
  {
    q: "Что с персональными данными в заявке?",
    a: "Обрабатываем только для связи по запросу, по Политике обработки ПДн, с вашим явным согласием.",
  },
] as const;

export const footerBlurb =
  "Сканер публичных страниц на контрольные точки 152-ФЗ: политика, cookie, формы и согласия.";

export { fixWithUs, sampleReport, whoFor };

export const finesUi = {
  eyebrow: "Ответственность",
  title: "Штрафы по ст. 13.11 КоАП",
  lead: "Ориентир для собственника. Это не расчёт вашего дела и не заключение юриста.",
  chartTitle: "Верхняя граница вилки",
  chartCaption:
    "Длина полосы — верхняя граница вилки. Оборотный штраф на шкалу не нанесён: он считается от выручки.",
  columns: {
    violation: "Нарушение",
    ip: "ИП",
    legal: "Юрлицо",
    norm: "Норма",
  },
  ipBar: "ИП",
  legalBar: "Юрлицо",
} as const;

export const calculatorUi = {
  eyebrow: "Ориентир",
  title: "Примерная вилка по типичным ситуациям",
  lead: "Отметьте, что узнаёте на сайте. Сумма считается в браузере из справочника штрафов и никуда не отправляется.",
  businessLegend: "Как оформлен бизнес",
  ip: "ИП",
  legal: "Юрлицо",
  issuesLegend: "Что уже есть на сайте",
  needBusiness: "Выберите ИП или юрлицо — вилка берётся из соответствующей колонки.",
  needIssues: "Отметьте хотя бы одну ситуацию.",
  resultLabel: "Ориентир по отмеченному",
  resultHint: "Сумма минимумов и сумма максимумов по отмеченным пунктам. Смягчение и совокупность здесь не учтены.",
} as const;

/** Тот же флаг, что `hero_speed_claim`. По умолчанию false. */
export const claims = {
  time_verified: flags.hero_speed_claim,
};

/** Не попадает в вёрстку, пока `hero_speed_claim` false. */
export const claimPlaceholders = {
  time: "за несколько минут",
} as const;

const HERO_CTA = "Проверить сайт";

const MAIN_HEADLINE = "Проверьте сайт на соответствие 152-ФЗ — и получите план, что исправить";

export type ResolvedHero = {
  headline: string;
  highlight: string | null;
  subline: string;
  sublineNarrow: string;
  cta: string;
};

export type HeroRenderOptions = {
  claims?: { time_verified: boolean };
  checksCountEnabled?: boolean;
  checksCount?: number | null;
};

function mainHeadline(timeVerified: boolean): string {
  if (!timeVerified) return MAIN_HEADLINE;
  return `Проверьте сайт на соответствие 152-ФЗ ${claimPlaceholders.time} — и получите план, что исправить`;
}

/** Срок и число проверок только при своих флагах. */
export function renderHero(options?: HeroRenderOptions): ResolvedHero {
  const timeVerified = options?.claims?.time_verified ?? claims.time_verified;
  const checksEnabled = options?.checksCountEnabled ?? flags.hero_checks_count;
  const checksCount = options?.checksCount ?? null;
  const headline = mainHeadline(timeVerified);
  return {
    headline,
    highlight: headline.includes("152-ФЗ") ? "152-ФЗ" : null,
    subline: heroSublineWithCount(checksEnabled, checksCount),
    sublineNarrow: heroSublineNarrowWithCount(checksEnabled, checksCount),
    cta: HERO_CTA,
  };
}

function collectText(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectText(item, out);
  }
}

/**
 * Текст, который лендинг реально показывает: герой уже с учётом флагов.
 * Плейсхолдеры claims сюда не попадают, пока флаги false.
 */
export function renderedLandingCopy(options?: HeroRenderOptions): string {
  const parts: string[] = [];
  collectText(renderHero(options), parts);
  collectText(
    {
      disclaimer,
      cta,
      heroChrome,
      trustItems,
      marqueeItems,
      whatWeCheckLead,
      faqs,
      footerBlurb,
      finesUi,
      calculatorUi,
      howSteps,
      checkWorkPoints,
      dataCallouts,
      checkGroupsTitle,
      checkGroups,
      formCopy,
      calculator: {
        title: calculatorCopy.title,
        lead: calculatorCopy.lead,
        resultTitle: calculatorCopy.resultTitle,
        unknownLine: calculatorCopy.unknownLine,
        noHits: calculatorCopy.noHits,
        manyUnknowns: calculatorCopy.manyUnknowns,
        separate: calculatorCopy.separate,
        footnote: calculatorCopy.footnote,
        disclaimer: calculatorCopy.disclaimer,
        cta: calculatorCopy.cta,
        ...(flags.show_fines
          ? { ownerHint: calculatorCopy.ownerHint, rangesDisclaimer: calculatorCopy.rangesDisclaimer }
          : {}),
        ...(flags.calc_client_only ? { clientOnly: calculatorCopy.clientOnly } : {}),
      },
      ...(flags.show_sample_report
        ? { sampleReport, ...(sampleRulesLine ? { sampleRulesLine } : {}), ...(sampleFinesNote ? { sampleFinesNote } : {}) }
        : {}),
      ...(flags.show_who_for ? { whoFor } : {}),
      ...(flags.show_fix_with_us
        ? {
            fixWithUs: flags.show_lead_form
              ? fixWithUs
              : { ...fixWithUs, discuss: "" },
          }
        : {}),
      footer: footerParagraphs(false),
      faq: faqItems(false),
    },
    parts,
  );
  return parts.join("\n");
}

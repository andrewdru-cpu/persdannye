/**
 * Тексты лендинга. Это черновик: финал утверждают маркетинг и юрист.
 * Суммы штрафов здесь не хранятся — они в `content/fines.ts`
 * и попадают на страницу только при одобрении.
 *
 * Живой герой — вариант A (`main`): без срока и без числа проверок,
 * пока юрист не включит флаги claims. B и C лежат рядом и не выбраны.
 */

export const disclaimer =
  "Информация носит информационный характер и не является юридической консультацией. Точные суммы зависят от обстоятельств дела.";

export const cta = {
  primary: "Проверить свой сайт",
  sticky: "Проверить сайт",
  stickyHint: "Риски 152-ФЗ по публичному URL",
  secondary: "Получить полный отчёт",
  checkFirst: "Сначала проверить сайт",
} as const;

export const heroChrome = {
  badge: "152-ФЗ / Роскомнадзор",
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

/**
 * Утверждения о сроке и числе проверок. Оба false, пока юрист не подтвердит.
 * Широкий boolean, чтобы ветки с фразами оставались в исходнике.
 */
export const claims = {
  time_verified: false as boolean,
  checks_count_verified: false as boolean,
};

/** Не попадают в вёрстку, пока соответствующий флаг false. */
export const claimPlaceholders = {
  time: "за несколько минут",
  checks: "десятки проверок",
} as const;

/** A — основной, B — запасной, C — только при `variant_c_enabled`. */
export type HeroVariantId = "main" | "fallback" | "c";

export const hero = {
  /** Вариант C выключен, пока собственник его не выберет. */
  variant_c_enabled: false as boolean,
};

/** Какой вариант на живой странице. */
export const activeHeroVariant: HeroVariantId = "main";

const HERO_CTA = "Проверить сайт";

const MAIN_HEADLINE = "Проверьте сайт на соответствие 152-ФЗ — и получите план, что исправить";
const FALLBACK_HEADLINE = "Персональные данные на сайте: проверим и покажем, что поправить";
const VARIANT_C_HEADLINE =
  "Узнайте, что на вашем сайте не так с 152-ФЗ, — до того, как это сделает проверка";

const SUB_LEAD = "Политика, согласия, cookie, формы и сторонние сервисы";
const SUB_TAIL = "Автоматическая проверка, не является юридической консультацией.";

export type ResolvedHero = {
  variant: HeroVariantId;
  headline: string;
  highlight: string | null;
  subline: string;
  cta: string;
  /** Вариант C: в герое и рядом с ним нет сумм и таймеров. */
  hideNearbyTimers: boolean;
  hideNearbyAmounts: boolean;
};

export type HeroRenderOptions = {
  variant?: HeroVariantId;
  claims?: { time_verified: boolean; checks_count_verified: boolean };
  variantCEnabled?: boolean;
};

function heroSubline(checksCountVerified: boolean): string {
  const dash = checksCountVerified
    ? `${claimPlaceholders.checks} публичной части сайта`
    : "проверка публичной части сайта";
  return `${SUB_LEAD} — ${dash}. ${SUB_TAIL}`;
}

function mainHeadline(timeVerified: boolean): string {
  if (!timeVerified) return MAIN_HEADLINE;
  return `Проверьте сайт на соответствие 152-ФЗ ${claimPlaceholders.time} — и получите план, что исправить`;
}

const nearbyTimer = /за\s+(?:60\s+секунд|минуту|несколько\s+минут)|секунд|минут|24\s*\/\s*7/iu;
const nearbyAmount = /₽/u;

function assertVariantC(headline: string, nearby: string): void {
  if (!headline.includes("проверка")) {
    throw new Error("hero variant C: в заголовке должно остаться слово «проверка»");
  }
  if (/ркн/iu.test(headline)) {
    throw new Error("hero variant C: в заголовке нельзя писать «РКН»");
  }
  if (nearbyTimer.test(nearby) || nearbyAmount.test(nearby)) {
    throw new Error("hero variant C: рядом с героем нельзя показывать суммы и таймеры");
  }
}

/** Текст героя и подписей в том же блоке — без калькулятора и таблицы штрафов. */
export function heroNearbyCopy(resolved: ResolvedHero): string {
  const parts: string[] = [resolved.headline, resolved.subline, resolved.cta];
  collectText(heroChrome, parts);
  return parts.join("\n");
}

/**
 * A (main) по умолчанию. Фразы срока и числа проверок только при своих флагах.
 * C не рендерится, пока `hero.variant_c_enabled` false.
 */
export function renderHero(options?: HeroRenderOptions): ResolvedHero {
  const flags = options?.claims ?? claims;
  const cEnabled = options?.variantCEnabled ?? hero.variant_c_enabled;
  const requested = options?.variant ?? activeHeroVariant;
  const variant: HeroVariantId = requested === "c" && !cEnabled ? "main" : requested;
  const subline = heroSubline(flags.checks_count_verified);
  const isC = variant === "c";

  const headline =
    variant === "fallback"
      ? FALLBACK_HEADLINE
      : variant === "c"
        ? VARIANT_C_HEADLINE
        : mainHeadline(flags.time_verified);

  const highlight =
    variant === "fallback" ? "что поправить" : headline.includes("152-ФЗ") ? "152-ФЗ" : null;

  const resolved: ResolvedHero = {
    variant,
    headline,
    highlight,
    subline,
    cta: HERO_CTA,
    hideNearbyTimers: isC,
    hideNearbyAmounts: isC,
  };

  if (isC) assertVariantC(headline, heroNearbyCopy(resolved));
  return resolved;
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
    },
    parts,
  );
  return parts.join("\n");
}

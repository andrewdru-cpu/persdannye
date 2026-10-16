/** Подзаголовок героя v1.2 без числа. На ширине от md. */
export const HERO_SUBLINE =
  "Политика, согласия, cookie, формы и сторонние сервисы — проверяем публичную часть сайта. Автоматическая проверка, не является юридической консультацией.";

/** Узкий экран, только CSS, без JS. Оговорка остаётся. */
export const HERO_SUBLINE_NARROW =
  "Автоматическая проверка публичной части сайта, не юридическая консультация";

/**
 * Фраза с числом проверок. Формулировку подтвердил Рост.
 * Флаг выключен, числа нет или N < 20 — фразы нет.
 */
export function heroChecksPhrase(enabled: boolean, count: number | null): string | null {
  if (!enabled || count === null || !Number.isInteger(count) || count < 20) return null;
  if (count === 20) return "20 проверок по 152-ФЗ";
  return "более 20 проверок по 152-ФЗ";
}

export function heroSublineWithCount(enabled: boolean, count: number | null): string {
  const phrase = heroChecksPhrase(enabled, count);
  return phrase ? `${phrase}. ${HERO_SUBLINE}` : HERO_SUBLINE;
}

export function heroSublineNarrowWithCount(enabled: boolean, count: number | null): string {
  const phrase = heroChecksPhrase(enabled, count);
  return phrase ? `${phrase}. ${HERO_SUBLINE_NARROW}` : HERO_SUBLINE_NARROW;
}

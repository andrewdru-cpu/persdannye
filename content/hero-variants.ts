/**
 * Черновики первого экрана без сумм. Финал формулировок — за маркетингом.
 *
 * Переключатель: `activeHeroVariantId`.
 * Вариантов с суммами и непроверенных утверждений о проверке Роскомнадзора здесь нет.
 * Если у варианта стоит `containsFineAmount`, страница всё равно берёт запасной
 * заголовок без цифр, пока штрафы не одобрены.
 */

export type HeroVariant = {
  id: string;
  headline: string;
  /** Подстрока headline для золотого акцента. */
  highlight?: string;
  subline: string;
  containsFineAmount: boolean;
};

export const heroVariants: readonly HeroVariant[] = [
  {
    id: "landing-is-operator",
    headline: "Даже лендинг с формой — это оператор ПДн.",
    highlight: "оператор ПДн",
    subline: "Проверьте сайт на требования 152-ФЗ за минуту.",
    containsFineAmount: false,
  },
  {
    id: "public-pages",
    headline: "Политика, форма и cookie — требования 152-ФЗ.",
    highlight: "152-ФЗ",
    subline: "Проверьте публичные страницы и получите список рисков.",
    containsFineAmount: false,
  },
];

/** Какой черновик показывать. */
export const activeHeroVariantId = "landing-is-operator";

/** Заголовок без цифр. */
export const heroFallbackVariantId = "landing-is-operator";

export type ResolvedHero = {
  id: string;
  headline: string;
  highlight: string | null;
  subline: string;
};

export function resolveHeroVariant(showAmounts: boolean): ResolvedHero {
  const active = heroVariants.find((variant) => variant.id === activeHeroVariantId);
  const fallback =
    heroVariants.find(
      (variant) => variant.id === heroFallbackVariantId && !variant.containsFineAmount,
    ) ?? heroVariants.find((variant) => !variant.containsFineAmount);

  if (!active || !fallback) {
    throw new Error("hero variants: не задан активный или безопасный вариант");
  }

  const chosen = active.containsFineAmount && !showAmounts ? fallback : active;
  if (chosen.containsFineAmount && !showAmounts) {
    throw new Error("hero variants: нет заголовка без сумм");
  }
  return {
    id: chosen.id,
    headline: chosen.headline,
    highlight: chosen.highlight ?? null,
    subline: chosen.subline,
  };
}

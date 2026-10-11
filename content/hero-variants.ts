/**
 * Черновики первого экрана. Финал — за маркетингом и юристом.
 *
 * Переключатель: `activeHeroVariantId`.
 * Если у выбранного варианта `containsFineAmount` и штрафы не одобрены
 * (`NEXT_PUBLIC_SHOW_FINES=true` и `approved: true` в `content/fines.ts`),
 * страница берёт `heroFallbackVariantId` — заголовок без сумм.
 *
 * Не импортировать из клиентских компонентов: иначе суммы попадут в браузерный бандл.
 */

export type HeroVariant = {
  id: string;
  headline: string;
  /** Подстрока headline для золотого акцента. */
  highlight?: string;
  subline: string;
  containsFineAmount: boolean;
  needs_legal_review: boolean;
};

export const heroVariants: readonly HeroVariant[] = [
  {
    id: "fine-one-form",
    headline: "Штраф до 700 000 ₽ за одну форму на сайте.",
    highlight: "700 000 ₽",
    subline: "Проверьте за 60 секунд — и спите спокойно.",
    containsFineAmount: true,
    needs_legal_review: false,
  },
  {
    id: "landing-is-operator",
    headline: "Даже лендинг с формой — это оператор ПДн.",
    highlight: "оператор ПДн",
    subline: "Не дайте штрафу закрыть бизнес.",
    containsFineAmount: false,
    needs_legal_review: false,
  },
  {
    id: "rkn-already-scanning",
    headline: "Роскомнадзор уже сканирует ваш сайт…",
    highlight: "сканирует ваш сайт",
    // Подзаголовок в ТЗ не задан — временная строка, её заменит маркетинг.
    subline: "Посмотрите, какие риски видны на публичных страницах.",
    containsFineAmount: false,
    needs_legal_review: true,
  },
];

/** Какой черновик показывать, когда суммы разрешены. */
export const activeHeroVariantId = "fine-one-form";

/** Заголовок без цифр. Обязан иметь containsFineAmount: false. */
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
  return {
    id: chosen.id,
    headline: chosen.headline,
    highlight: chosen.highlight ?? null,
    subline: chosen.subline,
  };
}

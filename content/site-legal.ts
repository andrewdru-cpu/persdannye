import { flags } from "./flags";

/**
 * Новая редакция политики (site-legal). Текста в репозитории нет.
 * Публиковать только после ОК Андрея: флаг show_site_legal и непустой документ.
 * Пока документа нет, /privacy остаётся прежней политикой.
 */
export type SiteLegalPrivacyDocument = {
  title: string;
  blocks: readonly string[];
};

export const siteLegalPrivacy: SiteLegalPrivacyDocument | null = null;

/** Маркеры новой редакции. В прежней политике и в выдаче /privacy их быть не должно. */
export const siteLegalPrivacyMarkers = [
  "лица, давшие согласие через форму проверки",
  "маркетинговый срок согласия",
] as const;

export function privacySurface(
  showSiteLegal: boolean = flags.show_site_legal,
  document: SiteLegalPrivacyDocument | null = siteLegalPrivacy
): "legacy" | "site-legal" {
  if (showSiteLegal && document && document.blocks.length > 0) return "site-legal";
  return "legacy";
}

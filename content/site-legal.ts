import { flags } from "./flags";

/**
 * Добавки site-legal к прежней политике. На /privacy попадают только при show_site_legal.
 * Флаг выключен, пока Андрей не дал ОК.
 */
export type SiteLegalPrivacyDocument = {
  title: string;
  blocks: readonly string[];
};

export const siteLegalPrivacy: SiteLegalPrivacyDocument | null = null;

/** Дословно, раздел о субъектах. Показываем только при включённом флаге. */
export const SITE_LEGAL_SUBJECTS_CLAUSE =
  "Сервис предназначен для организаций и ИП и их представителей старше 18 лет. Оператор не собирает данные несовершеннолетних намеренно. Если такие данные получены, они удаляются после обнаружения";

export function subjectsAgeClause(showSiteLegal: boolean = flags.show_site_legal): string | null {
  return showSiteLegal ? SITE_LEGAL_SUBJECTS_CLAUSE : null;
}

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

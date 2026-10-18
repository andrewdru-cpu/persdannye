import { flags } from "../content/flags";

/** Текст заглушки LegalPending. Не юридическая формулировка. */
export const LEGAL_PENDING_TEXT = "Текст не опубликован";

/** Строка в блоке «Оператор», пока реквизиты не опубликованы. */
export const OPERATOR_REQUISITES_PENDING =
  "Реквизиты оператора будут опубликованы до начала обработки";

export type LegalPublication = "pending" | "published";

/** Старые /privacy и /consent* видны только после включения show_site_legal. */
export function legalPublication(showSiteLegal = flags.show_site_legal): LegalPublication {
  return showSiteLegal ? "published" : "pending";
}

export function unpublishedRobots(showSiteLegal = flags.show_site_legal) {
  if (showSiteLegal) return undefined;
  return { index: false as const, follow: false as const };
}

/** noindex, пока флаг выключен или текста документа нет. Это не 404. */
export function legalRobots(
  show: boolean,
  document: unknown,
): { index: false; follow: false } | undefined {
  if (show && document) return undefined;
  return { index: false, follow: false };
}

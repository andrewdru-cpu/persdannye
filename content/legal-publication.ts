export const LEGAL_PENDING_TEXT = "Текст не опубликован";

/** noindex, пока флаг выключен или текста документа нет. Это не 404. */
export function legalRobots(
  show: boolean,
  document: unknown,
): { index: false; follow: false } | undefined {
  if (show && document) return undefined;
  return { index: false, follow: false };
}

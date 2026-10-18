import { flags } from "@/content/flags";

export const COLLECTION_DISABLED_ERROR = "collection_disabled";

export const COLLECTION_CLOSED_NOTICE =
  "Приём заявок откроется после публикации политики обработки персональных данных";

/** Заявки, сканы, аналитика и нетехнические cookie. */
export function isPdCollectionEnabled(): boolean {
  return flags.collect_pd === true;
}

/**
 * 503 до чтения тела, парсера, записи и логов.
 * null — сбор включён, маршрут работает как раньше.
 */
export function collectionGateResponse(): Response | null {
  if (isPdCollectionEnabled()) return null;
  return Response.json({ error: COLLECTION_DISABLED_ERROR }, { status: 503 });
}

import { flags } from "@/content/flags";

export const COLLECTION_DISABLED_ERROR = "collection_disabled";

/**
 * Сбор заявок, сканов, Метрики и необязательных cookie.
 * Только сервер: route handlers и server components. Клиенту — boolean через props.
 * true лишь при PD_COLLECTION_ENABLED="true" и опубликованной политике.
 */
export function collectionEnabled(): boolean {
  return process.env.PD_COLLECTION_ENABLED === "true" && flags.show_site_legal === true;
}

/**
 * 503 до чтения тела, парсера, записи и логов.
 * null — сбор включён, маршрут работает как раньше.
 */
export function collectionGateResponse(): Response | null {
  if (collectionEnabled()) return null;
  return Response.json({ error: COLLECTION_DISABLED_ERROR }, { status: 503 });
}

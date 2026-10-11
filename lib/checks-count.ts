import { applyParserHeaders, getParserBase } from "./parser-auth";

/** Путь публичного счётчика. Меняется здесь, если парсер перенесёт ручку. */
export const PARSER_CHECKS_COUNT_PATH = "/public/checks-count";

/** Как Cache-Control парсера: public, max-age=300. */
export const CHECKS_COUNT_REVALIDATE_SECONDS = 300;

export const CHECKS_COUNT_TIMEOUT_MS = 2000;

/** Целое из ответа парсера или null, если ответ нельзя показать. */
export function parseVisibleChecksCount(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { visible_checks_count?: unknown; rules_version?: unknown };
  const count = record.visible_checks_count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  if (typeof record.rules_version !== "string") return null;
  return count;
}

/** Серверный запрос. Ошибка, таймаут и невалидное тело дают null, без исключения на страницу. */
export async function loadVisibleChecksCount(): Promise<number | null> {
  const base = getParserBase();
  if (!base) return null;
  const headers = new Headers();
  applyParserHeaders(headers);
  headers.set("Accept", "application/json");
  try {
    const res = await fetch(`${base}${PARSER_CHECKS_COUNT_PATH}`, {
      headers,
      signal: AbortSignal.timeout(CHECKS_COUNT_TIMEOUT_MS),
      next: { revalidate: CHECKS_COUNT_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return parseVisibleChecksCount(await res.json());
  } catch {
    return null;
  }
}

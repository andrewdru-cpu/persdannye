import { applyParserHeaders, getParserBase } from "./parser-auth";

/** Путь публичного счётчика. Меняется здесь, если парсер перенесёт ручку. */
export const PARSER_CHECKS_COUNT_PATH = "/public/checks-count";

/**
 * Успешный ответ можно показать снова без запроса не дольше max-age парсера.
 * Это память процесса, не Data Cache и не HTML сборки.
 */
export const CHECKS_COUNT_REVALIDATE_SECONDS = 300;

/** Старше суток ответ не показываем, даже если новый запрос ещё не начался. */
export const CHECKS_COUNT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const CHECKS_COUNT_TIMEOUT_MS = 2000;

type CacheEntry = { count: number; fetchedAt: number };

let memory: CacheEntry | null = null;

export function resetChecksCountCache(): void {
  memory = null;
}

/** Целое из ответа парсера или null, если ответ нельзя показать. */
export function parseVisibleChecksCount(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { visible_checks_count?: unknown; rules_version?: unknown };
  const count = record.visible_checks_count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  if (typeof record.rules_version !== "string") return null;
  return count;
}

/**
 * Последний успех живёт не дольше 300 с.
 * Ошибка, таймаут и ответ старше 24 ч число стирают: в кэш Next оно не пишется.
 */
export async function resolveVisibleChecksCount(
  now: number,
  fetcher: () => Promise<number | null>,
): Promise<number | null> {
  if (memory && now - memory.fetchedAt >= CHECKS_COUNT_MAX_AGE_MS) {
    memory = null;
  }
  if (memory && now - memory.fetchedAt < CHECKS_COUNT_REVALIDATE_SECONDS * 1000) {
    return memory.count;
  }
  let count: number | null = null;
  try {
    count = await fetcher();
  } catch {
    count = null;
  }
  if (count === null || !Number.isInteger(count)) {
    memory = null;
    return null;
  }
  memory = { count, fetchedAt: now };
  return count;
}

async function fetchParserCount(): Promise<number | null> {
  const base = getParserBase();
  if (!base) return null;
  const headers = new Headers();
  applyParserHeaders(headers);
  headers.set("Accept", "application/json");
  const res = await fetch(`${base}${PARSER_CHECKS_COUNT_PATH}`, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(CHECKS_COUNT_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return parseVisibleChecksCount(await res.json());
}

/**
 * Только при включённом флаге. connection() не даёт запечь число в статическую сборку:
 * страница в этом режиме рендерится на запрос, без ISR со старым HTML.
 */
export async function loadVisibleChecksCount(): Promise<number | null> {
  const { connection } = await import("next/server");
  await connection();
  return resolveVisibleChecksCount(Date.now(), fetchParserCount);
}

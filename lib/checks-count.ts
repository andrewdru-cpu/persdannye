import { applyParserHeaders, getParserBase } from "./parser-auth";

/** Путь публичного счётчика. Меняется здесь, если парсер перенесёт ручку. */
export const PARSER_CHECKS_COUNT_PATH = "/public/checks-count";

/** Успешный ответ можно отдать из памяти процесса без нового запроса не дольше max-age парсера. */
export const CHECKS_COUNT_REVALIDATE_SECONDS = 300;

/** Старше суток успешный ответ на страницу не попадает. */
export const CHECKS_COUNT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const CHECKS_COUNT_TIMEOUT_MS = 2000;

/** Стабильный тег для алерта DevOps. Без числа и без персональных данных. */
export const CHECKS_COUNT_WARN =
  "[checks-count] N>=30: legal review of hero wording required";

export type ChecksCountSnapshot = {
  count: number;
  fetchedAt: number;
  generatedAt: number | null;
};

let memory: ChecksCountSnapshot | null = null;
let lastWarnedKey: string | null = null;

export function resetChecksCountCache(): void {
  memory = null;
  lastWarnedKey = null;
}

/** Целое из ответа парсера или null, если ответ нельзя показать. Неизвестные поля не читаются. */
export function parseVisibleChecksCount(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { visible_checks_count?: unknown; rules_version?: unknown };
  const count = record.visible_checks_count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  if (typeof record.rules_version !== "string") return null;
  return count;
}

/** ISO из generated_at, если поле есть и разбирается. Иначе null, поле не мешает ответу. */
export function parseGeneratedAt(body: unknown): number | null {
  if (!body || typeof body !== "object" || !("generated_at" in body)) return null;
  const value = (body as { generated_at?: unknown }).generated_at;
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

/**
 * Сравнение в момент рендера. Next при ошибке revalidate может вернуть старое тело навсегда,
 * поэтому возраст читаем из fetched_at, а не из факта «кэш ещё жив».
 */
export function checksCountForRender(snapshot: ChecksCountSnapshot | null, now: number): number | null {
  if (!snapshot) return null;
  if (now - snapshot.fetchedAt >= CHECKS_COUNT_MAX_AGE_MS) return null;
  if (snapshot.generatedAt !== null && now - snapshot.generatedAt >= CHECKS_COUNT_MAX_AGE_MS) return null;
  return snapshot.count;
}

/** Один раз на новое N ≥ 30. Повтор того же числа и отдача из памяти лог не пишут. */
function warnOnLargeCount(snapshot: ChecksCountSnapshot): void {
  if (snapshot.count < 30) return;
  const key = String(snapshot.count);
  if (lastWarnedKey === key) return;
  lastWarnedKey = key;
  console.warn(CHECKS_COUNT_WARN);
}

/**
 * Память процесса хранит последний успех вместе с fetched_at.
 * Ошибка не подменяет его более старым «навсегда»: на рендере возраст проверяется заново.
 * Ответ старше 24 ч и ошибка после такого ответа дают null.
 */
export async function resolveVisibleChecksCount(
  now: number,
  fetcher: () => Promise<{ count: number; generatedAt: number | null } | null>,
): Promise<ChecksCountSnapshot | null> {
  if (memory && now - memory.fetchedAt < CHECKS_COUNT_REVALIDATE_SECONDS * 1000) {
    return memory;
  }
  let received: { count: number; generatedAt: number | null } | null = null;
  try {
    received = await fetcher();
  } catch {
    received = null;
  }
  if (!received || !Number.isInteger(received.count) || received.count < 0) {
    return memory && checksCountForRender(memory, now) !== null ? memory : null;
  }
  memory = { count: received.count, fetchedAt: now, generatedAt: received.generatedAt };
  warnOnLargeCount(memory);
  return memory;
}

async function fetchParserCount(): Promise<{ count: number; generatedAt: number | null } | null> {
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
  const body: unknown = await res.json();
  const count = parseVisibleChecksCount(body);
  if (count === null) return null;
  return { count, generatedAt: parseGeneratedAt(body) };
}

/**
 * Только при включённом флаге. connection() не даёт запечь число в статическую сборку.
 * fetch с cache: no-store не кладёт тело в Data Cache Next, где ошибка revalidate
 * иначе отдавала бы его без срока.
 */
export async function loadVisibleChecksCount(now = Date.now()): Promise<number | null> {
  const { connection } = await import("next/server");
  await connection();
  const snapshot = await resolveVisibleChecksCount(now, fetchParserCount);
  return checksCountForRender(snapshot, now);
}

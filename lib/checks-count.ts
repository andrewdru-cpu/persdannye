import { applyParserHeaders, getParserBase } from "./parser-auth";

/** Путь публичного счётчика. Меняется здесь, если парсер перенесёт ручку. */
export const PARSER_CHECKS_COUNT_PATH = "/public/checks-count";

/** Успешный ответ можно отдать из памяти процесса без нового запроса не дольше max-age парсера. */
export const CHECKS_COUNT_REVALIDATE_SECONDS = 300;

/** Старше суток успешный ответ на страницу не попадает. */
export const CHECKS_COUNT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Дальше чем на 5 минут в будущем generated_at на страницу не попадает. */
export const CHECKS_COUNT_MAX_FUTURE_MS = 5 * 60 * 1000;

/** ISO UTC: Z или +00:00, дробные секунды по желанию. Без зоны и другие смещения — нет. */
const GENERATED_AT_UTC =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;

export const CHECKS_COUNT_TIMEOUT_MS = 2000;

/** Стабильный тег для алерта DevOps. Без числа и без персональных данных. */
export const CHECKS_COUNT_WARN =
  "[checks-count] N>=30: legal review of hero wording required";

export type ChecksCountSnapshot = {
  count: number;
  fetchedAt: number;
  /**
   * null — поля generated_at не было, возраст берём из fetched_at.
   * "invalid" — поле было, но это не ISO UTC с Z или +00:00.
   */
  generatedAt: number | null | "invalid";
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

/**
 * generated_at парсера: ISO UTC с Z или +00:00.
 * Поля нет — null (старая версия, дальше решает fetched_at).
 * Поле есть, но без зоны, с другим смещением или не разбирается — "invalid".
 * Неизвестные поля не читаются.
 */
export function parseGeneratedAt(body: unknown): number | null | "invalid" {
  if (!body || typeof body !== "object" || !("generated_at" in body)) return null;
  const value = (body as { generated_at?: unknown }).generated_at;
  if (typeof value !== "string" || !GENERATED_AT_UTC.test(value)) return "invalid";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "invalid";
  return ms;
}

/**
 * Сравнение в момент рендера. Next при ошибке revalidate может вернуть старое тело навсегда,
 * поэтому возраст своего запроса читаем из fetched_at.
 * Если generated_at есть, он тоже должен быть не старше 24 ч и не дальше 5 мин в будущем.
 */
export function checksCountForRender(snapshot: ChecksCountSnapshot | null, now: number): number | null {
  if (!snapshot) return null;
  if (now - snapshot.fetchedAt >= CHECKS_COUNT_MAX_AGE_MS) return null;
  if (snapshot.generatedAt === "invalid") return null;
  if (typeof snapshot.generatedAt === "number") {
    if (now - snapshot.generatedAt >= CHECKS_COUNT_MAX_AGE_MS) return null;
    if (snapshot.generatedAt - now > CHECKS_COUNT_MAX_FUTURE_MS) return null;
  }
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
  fetcher: () => Promise<{ count: number; generatedAt: number | null | "invalid" } | null>,
): Promise<ChecksCountSnapshot | null> {
  if (memory && now - memory.fetchedAt < CHECKS_COUNT_REVALIDATE_SECONDS * 1000) {
    return memory;
  }
  let received: { count: number; generatedAt: number | null | "invalid" } | null = null;
  try {
    received = await fetcher();
  } catch {
    received = null;
  }
  if (!received || !Number.isInteger(received.count) || received.count < 0) {
    return memory && checksCountForRender(memory, now) !== null ? memory : null;
  }
  memory = { count: received.count, fetchedAt: now, generatedAt: received.generatedAt };
  if (checksCountForRender(memory, now) !== null) warnOnLargeCount(memory);
  return memory;
}

async function fetchParserCount(): Promise<{ count: number; generatedAt: number | null | "invalid" } | null> {
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

/** Shown for every HTTP 503 from POST /api/leads when Retry-After is absent. */
export const LEAD_UNAVAILABLE_MESSAGE =
  "Не удалось отправить заявку, попробуйте через несколько минут";

/** Minutes from a Retry-After delay-seconds or HTTP-date. Null when the header cannot be read. */
export function leadRetryMinutes(retryAfter: string | null, nowMs = Date.now()): number | null {
  if (retryAfter == null) return null;
  const value = retryAfter.trim();
  if (!value) return null;
  let seconds: number;
  if (/^\d+$/.test(value)) {
    seconds = Number(value);
  } else {
    const when = Date.parse(value);
    if (Number.isNaN(when)) return null;
    seconds = Math.ceil((when - nowMs) / 1000);
  }
  if (!Number.isFinite(seconds)) return null;
  return Math.max(1, Math.ceil(seconds / 60));
}

/** 503 copy. A usable Retry-After replaces «несколько минут» with «~N мин». */
export function leadUnavailableMessage(retryAfter: string | null, nowMs = Date.now()): string {
  const minutes = leadRetryMinutes(retryAfter, nowMs);
  if (minutes == null) return LEAD_UNAVAILABLE_MESSAGE;
  return `Не удалось отправить заявку, попробуйте через ~${minutes} мин`;
}

/**
 * Same key only when the serialized body is unchanged. Any other body gets a new key.
 * The browser does not loop; a manual resubmit of the same body reuses the key.
 */
export function idempotencyKeyForBody(
  previous: { key: string; body: string } | null,
  body: string
): { key: string; body: string } {
  if (previous && previous.body === body) return previous;
  return { key: crypto.randomUUID(), body };
}

/**
 * One attempt. The caller keeps the same Idempotency-Key for a later manual submit of the same body.
 * There is no loop and no second fetch.
 */
export async function submitLeadOnce(
  body: unknown,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetchImpl("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Ошибка отправки" };
  }
  if (res.status === 503) {
    return { ok: false, message: leadUnavailableMessage(res.headers.get("retry-after")) };
  }
  let data: { error?: unknown } = {};
  try {
    data = (await res.json()) as { error?: unknown };
  } catch {
    data = {};
  }
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error.trim() : "";
    return { ok: false, message: message || "Ошибка отправки" };
  }
  return { ok: true };
}

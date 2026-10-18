/** Shown for every HTTP 503 from POST /api/leads, whatever error code the parser used. */
export const LEAD_UNAVAILABLE_MESSAGE =
  "Не удалось отправить заявку, попробуйте через несколько минут";

/**
 * One attempt. The caller keeps the same Idempotency-Key for a later manual submit.
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
  if (res.status === 503) return { ok: false, message: LEAD_UNAVAILABLE_MESSAGE };
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

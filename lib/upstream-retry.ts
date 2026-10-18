/**
 * One retry for a parser 503 that carries Retry-After.
 * The platform handler limit is 50s. The deadline used here stays under that,
 * so the wait and the second request cannot run the function out of time.
 * 401, 413, 429, and a 503 without a readable Retry-After are not retried.
 */

/** Strictly under the 50s handler limit. */
export const REQUEST_DEADLINE_MS = 49_000;

const FETCH_TIMEOUT_MS = 30_000;

/** Delay-seconds or an HTTP-date. Null when the header is missing or not a delay. */
export function retryAfterDelayMs(header: string | null, now: number): number | null {
  if (header == null) return null;
  const value = header.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds)) return null;
    return seconds * 1000;
  }
  const when = Date.parse(value);
  if (Number.isNaN(when)) return null;
  return Math.max(0, when - now);
}

/** Abort timeout for this attempt: at most 30s, and never past the deadline. */
export function attemptTimeoutMs(startedAt: number, now = Date.now()): number {
  const remaining = startedAt + REQUEST_DEADLINE_MS - now;
  return Math.min(FETCH_TIMEOUT_MS, Math.max(1, remaining));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 503 the client can show as "try later". No parser body and no failure cause. */
function tryLater(retryAfter: string | null): Response {
  const headers = new Headers();
  const value = retryAfter?.trim();
  if (value) headers.set("Retry-After", value);
  return Response.json({ error: "unavailable" }, { status: 503, headers });
}

/**
 * Call `send` once. On 503 with Retry-After, call it once more when the wait
 * ends before {@link REQUEST_DEADLINE_MS}. `send` must sign that attempt itself.
 * Any other status, including 401, 413, and 429, is returned without another call.
 */
export async function withUnavailableRetry(
  startedAt: number,
  send: () => Promise<Response>
): Promise<Response> {
  const first = await send();
  if (first.status !== 503) return first;

  const retryAfter = first.headers.get("retry-after");
  const now = Date.now();
  const delay = retryAfterDelayMs(retryAfter, now);
  if (delay === null) return first;

  // The next signature needs a new unix second. The same ts would replay.
  const wakeAt = Math.max(now + delay, (Math.floor(now / 1000) + 1) * 1000);
  if (wakeAt >= startedAt + REQUEST_DEADLINE_MS) {
    await first.arrayBuffer().catch(() => undefined);
    return tryLater(retryAfter);
  }

  await first.arrayBuffer().catch(() => undefined);
  await sleep(wakeAt - now);
  if (Date.now() >= startedAt + REQUEST_DEADLINE_MS) return tryLater(retryAfter);
  return send();
}

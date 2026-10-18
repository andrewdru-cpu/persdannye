/**
 * One retry for a parser 503 that carries Retry-After.
 * `maxDuration` is 60s. Five seconds stay unused before that limit.
 * The retry also needs a full 30s for the second attempt, so a Retry-After
 * of 30s does not fit. 401, 413, 429, and a 503 without Retry-After are not retried.
 * AbortError and TimeoutError become 503 with no parser detail.
 */

/** Platform handler limit. Matches `maxDuration` on POST /api/leads and on /api/checks. */
export const HANDLER_LIMIT_MS = 60_000;

/** Left unused before {@link HANDLER_LIMIT_MS}. A retry needs at least this much after the wait and the second attempt. */
export const RETRY_MARGIN_MS = 5_000;

/** Deadline for one lead or parser call. Five seconds short of the handler limit. */
export const REQUEST_DEADLINE_MS = HANDLER_LIMIT_MS - RETRY_MARGIN_MS;

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

function isAbortOrTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

/** The wait and a 30s second attempt must both finish with {@link RETRY_MARGIN_MS} still left. */
function retryFits(startedAt: number, wakeAt: number): boolean {
  return wakeAt + FETCH_TIMEOUT_MS + RETRY_MARGIN_MS <= startedAt + HANDLER_LIMIT_MS;
}

/**
 * Call `send` once. On 503 with Retry-After, call it once more when the wait
 * fits. `send` must sign that attempt itself.
 * Any other status, including 401, 413, and 429, is returned without another call.
 */
export async function withUnavailableRetry(
  startedAt: number,
  send: () => Promise<Response>
): Promise<Response> {
  let first: Response;
  try {
    first = await send();
  } catch (err) {
    if (isAbortOrTimeout(err)) return tryLater(null);
    throw err;
  }
  if (first.status !== 503) return first;

  const retryAfter = first.headers.get("retry-after");
  const now = Date.now();
  const delay = retryAfterDelayMs(retryAfter, now);
  if (delay === null) return first;

  // The next signature needs a new unix second. The same ts would replay.
  const wakeAt = Math.max(now + delay, (Math.floor(now / 1000) + 1) * 1000);
  if (!retryFits(startedAt, wakeAt)) {
    await first.arrayBuffer().catch(() => undefined);
    return tryLater(retryAfter);
  }

  await first.arrayBuffer().catch(() => undefined);
  await sleep(wakeAt - now);
  if (!retryFits(startedAt, Date.now())) return tryLater(retryAfter);
  try {
    return await send();
  } catch (err) {
    if (isAbortOrTimeout(err)) return tryLater(null);
    throw err;
  }
}

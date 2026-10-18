import { applySignedClientHeaders, ParserUnavailableError, parserSigningBlocked } from "./lead-guard";
import { applyParserHeaders, getParserBase } from "./parser-auth";
import { exceedsPublicLeadBytes, PUBLIC_LEAD_PATH } from "./public-lead";
import { attemptTimeoutMs, withUnavailableRetry } from "./upstream-retry";

/**
 * POST `{PARSER_API_BASE}/public/lead`.
 * The parser no longer serves `/api/leads` (that route is 404), so this is the only lead URL.
 * `Idempotency-Key` is set once and reused if a 503 with Retry-After is retried.
 * That retry signs again (new ts, same body bytes). 401, 413, and 429 are not retried.
 * An outgoing body over 16 KB is rejected here, before any signature or fetch.
 */
export async function postLeadToParser(
  body: unknown,
  incoming: Headers,
  idempotencyKey: string
): Promise<Response> {
  if (parserSigningBlocked()) throw new ParserUnavailableError();

  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  const raw = JSON.stringify(body);
  if (exceedsPublicLeadBytes(raw)) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  const url = `${base}${PUBLIC_LEAD_PATH}`;
  const startedAt = Date.now();
  return withUnavailableRetry(startedAt, () => sendLead(url, raw, incoming, idempotencyKey, startedAt));
}

async function sendLead(
  url: string,
  raw: string,
  incoming: Headers,
  idempotencyKey: string,
  startedAt: number
): Promise<Response> {
  const headers = new Headers();
  applyParserHeaders(headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Idempotency-Key", idempotencyKey);
  applySignedClientHeaders(headers, incoming, "POST", url, raw);

  return fetch(url, {
    method: "POST",
    headers,
    body: raw,
    cache: "no-store",
    signal: AbortSignal.timeout(attemptTimeoutMs(startedAt)),
  });
}

/** Status, body bytes, Content-Type, and Retry-After from the parser, with nothing added. */
export async function unchanged429(upstream: Response): Promise<Response> {
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const retry = upstream.headers.get("retry-after");
  if (retry !== null) headers.set("Retry-After", retry);
  const type = upstream.headers.get("content-type");
  if (type) headers.set("Content-Type", type);
  return new Response(body, { status: 429, headers });
}

const PASSTHROUGH = new Set([400, 409, 413, 422, 503]);

function leadErrorPayload(
  status: number,
  text: string
): { error: string; fields?: Record<string, string> } {
  let error = "unavailable";
  let fields: Record<string, string> | undefined;
  try {
    const json = JSON.parse(text) as { error?: unknown; fields?: unknown };
    if (typeof json.error === "string" && /^[a-z0-9_]{1,64}$/.test(json.error)) {
      error = json.error;
    }
    if (status === 400 && json.fields && typeof json.fields === "object" && !Array.isArray(json.fields)) {
      const copy: Record<string, string> = {};
      for (const [key, value] of Object.entries(json.fields as Record<string, unknown>)) {
        if (/^[a-z0-9_]{1,64}$/.test(key) && typeof value === "string" && value.length <= 200) {
          copy[key] = value;
        }
      }
      if (Object.keys(copy).length > 0) fields = copy;
    }
  } catch {
    // Keep the parser status. The body stays a short code, never the raw payload.
  }
  return fields ? { error, fields } : { error };
}

export type LeadUpstreamResult =
  | { kind: "created" }
  | { kind: "response"; response: Response }
  | { kind: "generic" };

/** Map a parser lead response onto the public contract without copying PII. */
export async function classifyLeadUpstream(upstream: Response): Promise<LeadUpstreamResult> {
  if (upstream.status === 201) {
    await upstream.arrayBuffer().catch(() => undefined);
    return { kind: "created" };
  }
  if (upstream.status === 429) {
    return { kind: "response", response: await unchanged429(upstream) };
  }
  if (PASSTHROUGH.has(upstream.status)) {
    const text = await upstream.text();
    const headers = new Headers();
    if (upstream.status === 503) {
      const retry = upstream.headers.get("retry-after");
      if (retry !== null) headers.set("Retry-After", retry);
    }
    return {
      kind: "response",
      response: Response.json(leadErrorPayload(upstream.status, text), {
        status: upstream.status,
        headers,
      }),
    };
  }
  await upstream.arrayBuffer().catch(() => undefined);
  return { kind: "generic" };
}

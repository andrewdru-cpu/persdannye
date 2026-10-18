import { applyParserHeaders, getParserBase } from "./parser-auth";
import { applySignedClientHeaders, ParserUnavailableError, parserSigningBlocked } from "./lead-guard";
import { PUBLIC_LEAD_PATH } from "./public-lead";

/**
 * One POST to the parser. parserFetch retries 502/503/504/429, which would
 * drop the original Retry-After and repeat a lead, so this path never retries.
 */
export async function postLeadToParser(
  body: unknown,
  incoming: Headers,
  idempotencyKey: string,
  nowMs = Date.now()
): Promise<Response> {
  if (parserSigningBlocked()) throw new ParserUnavailableError();

  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  const headers = new Headers();
  applyParserHeaders(headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Idempotency-Key", idempotencyKey);
  applySignedClientHeaders(headers, incoming, "POST", PUBLIC_LEAD_PATH, nowMs);

  return fetch(`${base}${PUBLIC_LEAD_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
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

const PASSTHROUGH = new Set([400, 409, 422, 503]);

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
    return {
      kind: "response",
      response: Response.json(leadErrorPayload(upstream.status, text), { status: upstream.status }),
    };
  }
  await upstream.arrayBuffer().catch(() => undefined);
  return { kind: "generic" };
}

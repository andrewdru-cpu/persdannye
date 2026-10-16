import { applyParserHeaders, getParserBase, getParserBearer } from "./parser-auth";
import { applySignedClientHeaders } from "./lead-guard";

/**
 * One POST to the parser. parserFetch retries 429, which would drop the
 * original Retry-After, so leads use a single attempt.
 */
export async function postLeadToParser(
  body: unknown,
  incoming: Headers,
  nowMs = Date.now()
): Promise<Response> {
  const base = getParserBase();
  if (!base) throw new Error("PARSER_API_BASE не задан");

  const headers = new Headers();
  applyParserHeaders(headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${await getParserBearer()}`);
  applySignedClientHeaders(headers, incoming, nowMs);

  return fetch(`${base}/api/leads`, {
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

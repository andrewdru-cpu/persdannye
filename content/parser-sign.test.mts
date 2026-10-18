import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { previousSigningSecret } from "../lib/deploy-env.ts";
import { bffSignatureMaterial, ParserUnavailableError, trustedClientIp } from "../lib/lead-guard.ts";
import { postLeadToParser } from "../lib/leads-upstream.ts";
import { clearParserToken, parserFetch } from "../lib/parser-auth.ts";

const SECRET = "0123456789abcdef0123456789abcdef";
const IP = "203.0.113.7";
const PUBLISHED_KEY = "test-key-0123456789abcdef0123456789abcdef";
const PUBLISHED_EMPTY = "7e6b604153f10ada26d35f39a4b91cf2b16a5ceb55a0c9745f214e8f7b69e98a";
const PUBLISHED_BODY = "1810e470f8492479571d2a4b9d324cf2e6a821bf2767390680925d048a40f0c9";
const LOGIN_BODY = JSON.stringify({ email: "svc@example.com", password: "parser-password" });
const EMPTY_SHA = createHash("sha256").update("").digest("hex");

const ENV_KEYS = [
  "PARSER_API_BASE",
  "PARSER_API_URL",
  "PARSER_API_TOKEN",
  "PARSER_API_KEY",
  "PARSER_API_EMAIL",
  "PARSER_API_PASSWORD",
  "PD_BFF_SIGNING_SECRET",
  "PD_BFF_SIGNING_SECRET_PREV",
  "VERCEL_ENV",
  "PD_DEPLOY_ENV",
] as const;

function snapshotEnv() {
  const saved = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) saved.set(key, process.env[key]);
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function bodySha(body?: BodyInit | null): string {
  if (body == null) return EMPTY_SHA;
  if (typeof body === "string") return createHash("sha256").update(body, "utf8").digest("hex");
  if (body instanceof ArrayBuffer) return createHash("sha256").update(new Uint8Array(body)).digest("hex");
  if (ArrayBuffer.isView(body)) {
    return createHash("sha256").update(Buffer.from(body.buffer, body.byteOffset, body.byteLength)).digest("hex");
  }
  throw new TypeError("unsupported test body");
}

function expectSig(headers: Headers, method: string, path: string, body?: BodyInit | null) {
  const ts = headers.get("x-pd-ts") ?? "";
  const ip = headers.get("x-pd-client-ip");
  assert.equal(ip, IP);
  const material = `${ts}\n${method.toUpperCase()}\n${path}\n${ip}\n${bodySha(body)}`;
  assert.equal(bffSignatureMaterial(ts, method.toLowerCase(), path, ip!, body), material);
  const expected = createHmac("sha256", SECRET).update(material).digest("hex");
  assert.equal(headers.get("x-pd-sig"), expected);
  assert.equal(material.includes(`${ts}.${method}`), false);
}

describe("parser request signatures", { concurrency: 1 }, () => {
  let restoreEnv: () => void = () => {};
  let restoreFetch: () => void = () => {};

  beforeEach(() => {
    restoreEnv = snapshotEnv();
    clearParserToken();
    process.env.PARSER_API_BASE = "https://parser.example";
    delete process.env.PARSER_API_URL;
    delete process.env.PARSER_API_TOKEN;
    delete process.env.PARSER_API_KEY;
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;
    process.env.PD_BFF_SIGNING_SECRET = SECRET;
    delete process.env.PD_BFF_SIGNING_SECRET_PREV;
    delete process.env.VERCEL_ENV;
    delete process.env.PD_DEPLOY_ENV;
    const prev = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("unexpected fetch");
    }) as typeof fetch;
    restoreFetch = () => {
      globalThis.fetch = prev;
    };
  });

  afterEach(() => {
    clearParserToken();
    restoreFetch();
    restoreEnv();
  });

  it("stamps a fresh integer unix second from the fake clock before each fetch", async () => {
    process.env.PARSER_API_EMAIL = "svc@example.com";
    process.env.PARSER_API_PASSWORD = "parser-password";
    const realNow = Date.now;
    let nowMs = 1_760_817_600_123;
    Date.now = () => nowMs;
    const seen: Array<{ url: string; ts: string }> = [];
    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        const ts = headers.get("x-pd-ts") ?? "";
        seen.push({ url: String(input), ts });
        assert.match(ts, /^\d+$/);
        assert.equal(Number.isInteger(Number(ts)), true);
        assert.equal(ts, String(Math.floor(nowMs / 1000)));
        assert.equal(ts.includes("."), false);
        if (String(input).endsWith("/api/auth/login")) {
          nowMs += 61_000;
          return new Response(JSON.stringify({ access_token: "jwt", expires_in: 3600 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }) as typeof fetch;

      await parserFetch("/api/scans", { method: "POST", body: "{}" }, true, new Headers({ "x-real-ip": IP }));
      assert.equal(seen.length, 2);
      assert.equal(seen[0].url, "https://parser.example/api/auth/login");
      assert.equal(seen[0].ts, "1760817600");
      assert.equal(seen[1].url, "https://parser.example/api/scans");
      assert.equal(seen[1].ts, "1760817661");
      assert.notEqual(seen[0].ts, seen[1].ts);
    } finally {
      Date.now = realNow;
    }
  });

  it("uppercases a lowercase method in the signed string", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    const calls: Array<{ headers: Headers }> = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ headers: new Headers(init?.headers) });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    await parserFetch("/api/scans", { method: "get" }, true, new Headers({ "x-real-ip": IP }));
    const ts = calls[0].headers.get("x-pd-ts") ?? "";
    const material = `${ts}\nGET\n/api/scans\n${IP}\n${EMPTY_SHA}`;
    const expected = createHmac("sha256", SECRET).update(material).digest("hex");
    assert.equal(calls[0].headers.get("x-pd-sig"), expected);
    assert.equal(bffSignatureMaterial(ts, "get", "/api/scans", IP), material);
  });

  it("signs /public/lead/ and /public/lead?x=1 as /public/lead", async () => {
    const canonical = `1760817600\nPOST\n/public/lead\n203.0.113.7\n${EMPTY_SHA}`;
    assert.equal(bffSignatureMaterial("1760817600", "POST", "/public/lead/", "203.0.113.7"), canonical);
    assert.equal(bffSignatureMaterial("1760817600", "post", "/public/lead?x=1", "203.0.113.7"), canonical);
    assert.notEqual(bffSignatureMaterial("1760817600", "POST", "/api/leads", "203.0.113.7"), canonical);
    const expected = createHmac("sha256", SECRET).update(canonical).digest("hex");
    assert.equal(
      createHmac("sha256", SECRET).update(bffSignatureMaterial("1760817600", "POST", "/public/lead/", "203.0.113.7")).digest("hex"),
      expected
    );

    process.env.PARSER_API_TOKEN = "parser-token";
    const calls: Array<{ url: string; headers: Headers }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const client = new Headers({ "x-real-ip": IP });
    await parserFetch("/public/lead/", { method: "post" }, true, client);
    await parserFetch("/public/lead?x=1", { method: "post" }, true, client);
    assert.deepEqual(
      calls.map((call) => call.url),
      ["https://parser.example/public/lead/", "https://parser.example/public/lead?x=1"]
    );
    for (const call of calls) {
      const ts = call.headers.get("x-pd-ts") ?? "";
      const material = `${ts}\nPOST\n/public/lead\n${IP}\n${EMPTY_SHA}`;
      const sig = createHmac("sha256", SECRET).update(material).digest("hex");
      assert.equal(call.headers.get("x-pd-sig"), sig);
      const vercel = createHmac("sha256", SECRET).update(`${ts}\nPOST\n/api/leads\n${IP}\n${EMPTY_SHA}`).digest("hex");
      assert.notEqual(call.headers.get("x-pd-sig"), vercel);
    }
  });

  it("signs a URL that has a query without that query", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    const calls: Array<{ url: string; headers: Headers }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    await parserFetch("/public/lead?a=1", { method: "post" }, true, new Headers({ "x-real-ip": IP }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://parser.example/public/lead?a=1");
    const ts = calls[0].headers.get("x-pd-ts") ?? "";
    const material = `${ts}\nPOST\n/public/lead\n${IP}\n${EMPTY_SHA}`;
    const expected = createHmac("sha256", SECRET).update(material).digest("hex");
    assert.equal(calls[0].headers.get("x-pd-sig"), expected);
    assert.equal(material.includes("?"), false);
    assert.equal(material.includes("a=1"), false);
    assert.equal(
      bffSignatureMaterial("1760817600", "post", "https://parser.example/public/lead?a=1#section", "203.0.113.7"),
      `1760817600\nPOST\n/public/lead\n203.0.113.7\n${EMPTY_SHA}`
    );
  });

  it("signs a scan with HMAC of ts, method, path, ip, and the body hash", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    const calls: Array<{ url: string; headers: Headers }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify({ scan_id: "s" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = new Headers({ "x-real-ip": IP, "x-pd-client-ip": "198.51.100.99" });
    const res = await parserFetch("/api/scans", { method: "POST", body: "{}" }, true, client);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://parser.example/api/scans");
    assert.equal(calls[0].headers.get("x-pd-client-ip"), IP);
    expectSig(calls[0].headers, "POST", "/api/scans", "{}");
    const emptyBodySig = createHmac("sha256", SECRET)
      .update(`${calls[0].headers.get("x-pd-ts")}\nPOST\n/api/scans\n${IP}\n${EMPTY_SHA}`)
      .digest("hex");
    assert.notEqual(calls[0].headers.get("x-pd-sig"), emptyBodySig);
    assert.equal(calls[0].headers.get("x-pd-client-ip")?.includes("198.51.100.99"), false);
  });

  it("signs login and the following scan", async () => {
    process.env.PARSER_API_EMAIL = "svc@example.com";
    process.env.PARSER_API_PASSWORD = "parser-password";
    const calls: Array<{ url: string; headers: Headers }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      if (url.endsWith("/api/auth/login")) {
        return new Response(JSON.stringify({ access_token: "jwt", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = new Headers({ "x-real-ip": IP });
    await parserFetch("/api/scans/scan-1", { method: "GET" }, true, client);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://parser.example/api/auth/login");
    assert.equal(calls[1].url, "https://parser.example/api/scans/scan-1");
    expectSig(calls[0].headers, "POST", "/api/auth/login", LOGIN_BODY);
    expectSig(calls[1].headers, "GET", "/api/scans/scan-1");
    const loginEmpty = createHmac("sha256", SECRET)
      .update(`${calls[0].headers.get("x-pd-ts")}\nPOST\n/api/auth/login\n${IP}\n${EMPTY_SHA}`)
      .digest("hex");
    assert.notEqual(calls[0].headers.get("x-pd-sig"), loginEmpty);
  });

  it("does not call the parser in production without a usable secret", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    process.env.VERCEL_ENV = "production";
    process.env.PD_BFF_SIGNING_SECRET = "a".repeat(31);
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await assert.rejects(
      () => parserFetch("/api/scans", { method: "GET" }, true, new Headers({ "x-real-ip": IP })),
      (err: unknown) => err instanceof ParserUnavailableError && err.message === "unavailable"
    );
    assert.equal(calls, 0);
  });

  it("sends the published v2 signatures in X-PD-Sig on the intercepted fetch", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    process.env.PD_BFF_SIGNING_SECRET = PUBLISHED_KEY;
    process.env.PD_BFF_SIGNING_SECRET_PREV = "prev-key-0123456789abcdef0123456789abcdef";
    assert.equal(previousSigningSecret(), "prev-key-0123456789abcdef0123456789abcdef");
    const realNow = Date.now;
    Date.now = () => 1_700_000_000_000;
    const seen: Array<{
      url: string;
      body: string | null;
      sig: string | null;
      ts: string | null;
      ip: string | null;
      idempotency: string | null;
    }> = [];
    const client = new Headers({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.8, 203.0.113.99",
      "x-pd-client-ip": "198.51.100.99",
    });
    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        let body: string | null = null;
        if (typeof init?.body === "string") body = init.body;
        else if (init?.body instanceof Uint8Array) body = Buffer.from(init.body).toString("utf8");
        seen.push({
          url: String(input),
          body,
          sig: headers.get("x-pd-sig"),
          ts: headers.get("x-pd-ts"),
          ip: headers.get("x-pd-client-ip"),
          idempotency: headers.get("idempotency-key"),
        });
        return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
      }) as typeof fetch;

      await parserFetch("/public/lead", { method: "POST" }, true, client);
      await parserFetch("/public/lead", { method: "POST", body: '{"name":"Test"}' }, true, client);
      const raw = Buffer.from('{"name":"Test"}');
      assert.equal(raw.length, 15);
      await parserFetch("/public/lead", { method: "POST", body: raw }, true, client);
      await postLeadToParser({ name: "Test" }, client, "22222222-2222-4222-8222-222222222222");
    } finally {
      Date.now = realNow;
    }

    assert.equal(seen.length, 4);
    for (const call of seen) {
      assert.equal(call.url, "https://parser.example/public/lead");
      assert.equal(call.ts, "1700000000");
      assert.equal(call.ip, "203.0.113.10");
      assert.equal(call.ip === "198.51.100.8", false);
      assert.equal(call.ip === "198.51.100.99", false);
    }
    assert.equal(seen[0].body, null);
    assert.equal(seen[0].sig, PUBLISHED_EMPTY);
    assert.equal(seen[1].body, '{"name":"Test"}');
    assert.equal(Buffer.byteLength(seen[1].body ?? "", "utf8"), 15);
    assert.equal(seen[1].sig, PUBLISHED_BODY);
    assert.equal(seen[2].body, '{"name":"Test"}');
    assert.equal(seen[2].sig, PUBLISHED_BODY);
    assert.equal(seen[3].body, '{"name":"Test"}');
    assert.equal(seen[3].sig, PUBLISHED_BODY);
    assert.equal(seen[3].idempotency, "22222222-2222-4222-8222-222222222222");
    assert.equal(seen[3].sig === PUBLISHED_EMPTY, false);
    const signedWithPrev = createHmac("sha256", "prev-key-0123456789abcdef0123456789abcdef")
      .update(bffSignatureMaterial("1700000000", "POST", "/public/lead", "203.0.113.10", '{"name":"Test"}'))
      .digest("hex");
    assert.notEqual(seen[1].sig, signedWithPrev);
    assert.notEqual(seen[0].sig, seen[1].sig);
  });

  it("prefers the Vercel address over a client x-real-ip and x-forwarded-for", () => {
    assert.equal(
      trustedClientIp(
        new Headers({
          "x-real-ip": "203.0.113.10",
          "x-vercel-forwarded-for": "192.0.2.5",
          "x-forwarded-for": "198.51.100.8, 203.0.113.99",
          "x-pd-client-ip": "198.51.100.99",
          forwarded: "for=198.51.100.3",
          "cf-connecting-ip": "198.51.100.1",
          "true-client-ip": "198.51.100.2",
        })
      ),
      "192.0.2.5"
    );
    assert.equal(
      trustedClientIp(
        new Headers({
          "x-vercel-forwarded-for": "203.0.113.50, 192.0.2.5",
          "x-forwarded-for": "198.51.100.8, 203.0.113.77",
          "x-pd-client-ip": "198.51.100.99",
        })
      ),
      "203.0.113.50"
    );
    assert.equal(
      trustedClientIp(
        new Headers({
          "x-forwarded-for": "198.51.100.8, 203.0.113.10",
          "x-pd-client-ip": "203.0.113.10",
          forwarded: "for=203.0.113.10",
        })
      ),
      null
    );
    assert.equal(previousSigningSecret({ PD_BFF_SIGNING_SECRET_PREV: "a".repeat(31) } as NodeJS.ProcessEnv), null);
    assert.equal(previousSigningSecret({ PD_BFF_SIGNING_SECRET_PREV: `  ${"b".repeat(32)}  ` } as NodeJS.ProcessEnv), "b".repeat(32));
  });

  it("signs the fetch URL path when PARSER_API_BASE has a prefix", async () => {
    process.env.PARSER_API_BASE = "https://host/api";
    process.env.PARSER_API_TOKEN = "parser-token";
    const realNow = Date.now;
    Date.now = () => 1_700_000_000_000;
    const calls: Array<{ url: string; headers: Headers; body: string | null }> = [];
    const client = new Headers({
      "x-real-ip": "198.51.100.8",
      "x-forwarded-for": "198.51.100.9",
      "x-vercel-forwarded-for": IP,
    });
    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          headers: new Headers(init?.headers),
          body: typeof init?.body === "string" ? init.body : null,
        });
        return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
      }) as typeof fetch;

      await parserFetch("/public/lead", { method: "POST", body: "{}" }, true, client);
      await postLeadToParser({ name: "Test" }, client, "22222222-2222-4222-8222-222222222222");
    } finally {
      Date.now = realNow;
    }

    assert.equal(calls.length, 2);
    for (const call of calls) {
      const pathname = new URL(call.url).pathname;
      assert.equal(call.url, "https://host/api/public/lead");
      assert.equal(pathname, "/api/public/lead");
      const ts = call.headers.get("x-pd-ts") ?? "";
      const material = `${ts}\nPOST\n${pathname}\n${IP}\n${bodySha(call.body)}`;
      const expected = createHmac("sha256", SECRET).update(material).digest("hex");
      assert.equal(call.headers.get("x-pd-sig"), expected);
      assert.equal(call.headers.get("x-pd-client-ip"), IP);
      const withoutPrefix = createHmac("sha256", SECRET)
        .update(`${ts}\nPOST\n/public/lead\n${IP}\n${bodySha(call.body)}`)
        .digest("hex");
      assert.notEqual(call.headers.get("x-pd-sig"), withoutPrefix);
    }
    assert.equal(calls[1].headers.get("idempotency-key"), "22222222-2222-4222-8222-222222222222");
    assert.equal(calls[1].body, '{"name":"Test"}');
  });

  it("retries parserFetch only on 503 with Retry-After and re-signs that one call", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    const key = "33333333-3333-4333-8333-333333333333";
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_700_000_000_000 });
    const calls: Array<{ headers: Headers; body: string | null }> = [];
    const client = new Headers({ "x-real-ip": IP });
    const init: RequestInit = {
      method: "POST",
      body: "{}",
      headers: { "Idempotency-Key": key },
    };
    try {
      globalThis.fetch = (async (_input: RequestInfo | URL, request?: RequestInit) => {
        calls.push({
          headers: new Headers(request?.headers),
          body: typeof request?.body === "string" ? request.body : null,
        });
        if (calls.length === 1) {
          return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
            status: 503,
            headers: { "Retry-After": "1", "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
      }) as typeof fetch;

      const pending = parserFetch("/api/scans", init, true, client);
      for (let i = 0; i < 40; i++) await Promise.resolve();
      mock.timers.tick(1_000);
      for (let i = 0; i < 40; i++) await Promise.resolve();
      const res = await pending;
      assert.equal(res.status, 201);
      assert.equal(calls.length, 2);
      assert.notEqual(calls[0].headers.get("x-pd-ts"), calls[1].headers.get("x-pd-ts"));
      assert.notEqual(calls[0].headers.get("x-pd-sig"), calls[1].headers.get("x-pd-sig"));
      assert.equal(calls[0].headers.get("idempotency-key"), key);
      assert.equal(calls[1].headers.get("idempotency-key"), key);
      assert.equal(calls[0].body, calls[1].body);
    } finally {
      mock.timers.reset();
    }

    for (const status of [401, 413, 429]) {
      let n = 0;
      globalThis.fetch = (async () => {
        n += 1;
        return new Response("{}", { status, headers: { "Retry-After": "1" } });
      }) as typeof fetch;
      const res = await parserFetch("/api/scans", { method: "GET" }, true, client);
      assert.equal(res.status, status);
      assert.equal(n, 1, String(status));
    }
  });
});

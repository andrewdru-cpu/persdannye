import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { bffSignatureMaterial, ParserUnavailableError } from "../lib/lead-guard.ts";
import { clearParserToken, parserFetch } from "../lib/parser-auth.ts";

const SECRET = "0123456789abcdef0123456789abcdef";
const IP = "203.0.113.7";

const ENV_KEYS = [
  "PARSER_API_BASE",
  "PARSER_API_URL",
  "PARSER_API_TOKEN",
  "PARSER_API_KEY",
  "PARSER_API_EMAIL",
  "PARSER_API_PASSWORD",
  "PD_BFF_SIGNING_SECRET",
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

function expectSig(headers: Headers, method: string, path: string) {
  const ts = headers.get("x-pd-ts") ?? "";
  const ip = headers.get("x-pd-client-ip");
  assert.equal(ip, IP);
  const material = `${ts}.${method}.${path}.${ip}`;
  assert.equal(bffSignatureMaterial(ts, method.toLowerCase(), path, ip!), material);
  const expected = createHmac("sha256", SECRET).update(material).digest("hex");
  assert.equal(headers.get("x-pd-sig"), expected);
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

  it("uppercases a lowercase method in the signed string", async () => {
    process.env.PARSER_API_TOKEN = "parser-token";
    const calls: Array<{ headers: Headers }> = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ headers: new Headers(init?.headers) });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    await parserFetch("/api/scans", { method: "get" }, true, new Headers({ "x-real-ip": IP }));
    const ts = calls[0].headers.get("x-pd-ts") ?? "";
    const material = `${ts}.GET./api/scans.${IP}`;
    const expected = createHmac("sha256", SECRET).update(material).digest("hex");
    assert.equal(calls[0].headers.get("x-pd-sig"), expected);
    assert.equal(bffSignatureMaterial(ts, "get", "/api/scans", IP), material);
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
    const material = `${ts}.POST./public/lead.${IP}`;
    const expected = createHmac("sha256", SECRET).update(material).digest("hex");
    assert.equal(calls[0].headers.get("x-pd-sig"), expected);
    assert.equal(material.includes("?"), false);
    assert.equal(material.includes("a=1"), false);
    assert.equal(
      bffSignatureMaterial("1760817600", "post", "https://parser.example/public/lead?a=1#section", "203.0.113.7"),
      "1760817600.POST./public/lead.203.0.113.7"
    );
  });

  it("signs a scan with HMAC of ts.method.path.ip", async () => {
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
    expectSig(calls[0].headers, "POST", "/api/scans");
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
    expectSig(calls[0].headers, "POST", "/api/auth/login");
    expectSig(calls[1].headers, "GET", "/api/scans/scan-1");
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
});

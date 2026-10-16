import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST } from "../app/api/leads/route.ts";
import { dataFilePath } from "../lib/data-dir.ts";
import { allowedOriginsFromEnv, isAllowedOrigin, maskIp, stripClientPdHeaders } from "../lib/lead-guard.ts";

const PROD = "https://persdannye.ru";
const PREVIEW = "https://persdannye.vercel.app";
const SECRET = "test-signing-secret";
const RAW_IP = "203.0.113.10";
const MASKED_IP = "203.0.113.0";
const FORGED_IP = "198.51.100.99";
const FORWARDED_FOR = "198.51.100.8";
const EMAIL = "anna@example.com";
const PHONE = "+79990001122";
const NAME = "Анна";
const MESSAGE = "Нужен разбор";

const lead = {
  name: NAME,
  email: EMAIL,
  phone: PHONE,
  url: "https://example.com",
  checkId: "11111111-1111-1111-1111-111111111111",
  message: MESSAGE,
  consent: true,
  consent_text_version: "2026-10-11-lead",
  marketing_consent: false,
  source: "landing",
};

const ENV_KEYS = [
  "ALLOWED_ORIGINS",
  "PD_BFF_SIGNING_SECRET",
  "LEADS_IP_HMAC_SECRET",
  "PARSER_API_BASE",
  "PARSER_API_URL",
  "PARSER_API_TOKEN",
  "PARSER_API_KEY",
  "PARSER_API_EMAIL",
  "PARSER_API_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
] as const;

const PII = [EMAIL, PHONE, NAME, MESSAGE];

let restoreEnv: () => void = () => {};
let restoreFetch: () => void = () => {};
let restoreNow: () => void = () => {};
let logs: string[] = [];
let restoreLogs: () => void = () => {};

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

function captureLogs() {
  logs = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const prev = methods.map((method) => console[method].bind(console));
  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      logs.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    };
  }
  return () => {
    methods.forEach((method, index) => {
      console[method] = prev[index] as (typeof console)[typeof method];
    });
  };
}

function assertNoLeadPii(text: string) {
  for (const value of PII) assert.equal(text.includes(value), false, value);
}

function assertLogsMasked() {
  const text = logs.join("\n");
  assertNoLeadPii(text);
  assert.equal(text.includes(RAW_IP), false);
  assert.equal(text.includes(FORGED_IP), false);
  assert.equal(text.includes(FORWARDED_FOR), false);
}

function leadRequest(
  origin: string | null,
  extra?: Record<string, string | null>,
  body: unknown = lead
) {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (origin !== null) headers.set("origin", origin);
  headers.set("x-real-ip", RAW_IP);
  headers.set("x-forwarded-for", FORWARDED_FOR);
  headers.set("x-pd-client-ip", FORGED_IP);
  headers.set("x-pd-ts", "1");
  headers.set("x-pd-sig", "deadbeef");
  headers.set("x-pd-note", EMAIL);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === null) headers.delete(key);
      else headers.set(key, value);
    }
  }
  return new Request(`${PROD}/api/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function outgoingHeaders(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

function signature(ts: string, ip: string, secret = SECRET) {
  return createHmac("sha256", secret).update(`${ts}.${ip}`).digest("hex");
}

describe("POST /api/leads", { concurrency: 1 }, () => {
  beforeEach(() => {
    restoreEnv = snapshotEnv();
    process.env.ALLOWED_ORIGINS = `${PROD},${PREVIEW}`;
    process.env.PD_BFF_SIGNING_SECRET = SECRET;
    delete process.env.LEADS_IP_HMAC_SECRET;
    process.env.PARSER_API_BASE = "https://parser.example";
    delete process.env.PARSER_API_URL;
    process.env.PARSER_API_TOKEN = "parser-token";
    delete process.env.PARSER_API_KEY;
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    restoreLogs = captureLogs();
    const prevFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("unexpected fetch");
    }) as typeof fetch;
    restoreFetch = () => {
      globalThis.fetch = prevFetch;
    };
    const prevNow = Date.now;
    restoreNow = () => {
      Date.now = prevNow;
    };
  });

  afterEach(() => {
    restoreNow();
    restoreFetch();
    restoreLogs();
    restoreEnv();
  });

  it("rejects a missing Origin", async () => {
    const res = await POST(leadRequest(null));
    assert.equal(res.status, 403);
    assertNoLeadPii(await res.text());
    assertLogsMasked();
  });

  it("rejects Origin null", async () => {
    const res = await POST(leadRequest("null"));
    assert.equal(res.status, 403);
    assertNoLeadPii(await res.text());
    assertLogsMasked();
  });

  it("rejects a foreign origin", async () => {
    const res = await POST(leadRequest("https://evil.example"));
    assert.equal(res.status, 403);
    assertNoLeadPii(await res.text());
    assertLogsMasked();
  });

  it("rejects a lookalike vercel host", async () => {
    const allowed = allowedOriginsFromEnv(`${PROD},${PREVIEW}`);
    assert.equal(isAllowedOrigin(PREVIEW, allowed), true);
    assert.equal(isAllowedOrigin("https://persdannye.vercel.app.evil.com", allowed), false);
    assert.equal(isAllowedOrigin(`${PREVIEW}/`, allowed), false);
    const res = await POST(leadRequest("https://persdannye.vercel.app.evil.com"));
    assert.equal(res.status, 403);
    const body = await res.text();
    assert.equal(body.includes("persdannye.vercel.app.evil.com"), false);
    assertNoLeadPii(body);
    assertLogsMasked();
  });

  it("passes a parser 429 through with Retry-After", async () => {
    const parserBody = '{"error":"rate_limited","detail":"подождите"}';
    const calls: RequestInit[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init ?? {});
      return new Response(parserBody, {
        status: 429,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": "17",
          "X-Should-Not-Leak": EMAIL,
        },
      });
    }) as typeof fetch;

    const before = storedCopies(EMAIL);
    const res = await POST(leadRequest(PROD));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "17");
    assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(res.headers.get("x-should-not-leak"), null);
    assert.equal(await res.text(), parserBody);
    assert.equal(calls.length, 1);
    assert.equal(storedCopies(EMAIL), before);
    assertLogsMasked();
    assert.match(logs.join("\n"), new RegExp(MASKED_IP.replaceAll(".", "\\.")));
  });

  it("accepts a valid lead", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ id: "upstream", email: EMAIL, name: NAME }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const res = await POST(leadRequest(PREVIEW));
    assert.equal(res.status, 201);
    const payload = (await res.json()) as { ok?: boolean; id?: string; email?: string };
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.id, "string");
    assert.equal(payload.email, undefined);
    assertNoLeadPii(JSON.stringify(payload));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://parser.example/api/leads");
    const headers = outgoingHeaders(calls[0].init);
    const ts = headers.get("x-pd-ts") || "";
    const tsNum = Number(ts);
    assert.equal(Number.isInteger(tsNum), true);
    assert.equal(Math.abs(tsNum - Math.floor(Date.now() / 1000)) <= 2, true);
    assert.equal(headers.get("x-pd-client-ip"), RAW_IP);
    assert.equal(headers.get("x-pd-sig"), signature(ts, RAW_IP));
    assert.equal(headers.get("x-pd-client-ts"), null);
    assert.equal(headers.get("x-pd-client-sig"), null);
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(headers.get("authorization"), "Bearer parser-token");
    const forwarded = JSON.stringify(Object.fromEntries(headers.entries()));
    assert.equal(forwarded.includes(FORGED_IP), false);
    assert.equal(forwarded.includes(EMAIL), false);
    assertLogsMasked();
    assert.match(logs.join("\n"), new RegExp(MASKED_IP.replaceAll(".", "\\.")));
  });

  it("accepts a valid lead again after the 429 window", async () => {
    let nowMs = 1_800_000_000_000;
    Date.now = () => nowMs;
    let openAt = 0;
    const rateBody = '{"error":"rate_limited"}';
    const calls: Headers[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = outgoingHeaders(init);
      calls.push(headers);
      const ts = Number(headers.get("x-pd-ts"));
      if (!openAt) {
        openAt = ts + 30;
        return new Response(rateBody, {
          status: 429,
          headers: { "Retry-After": "30", "Content-Type": "application/json" },
        });
      }
      if (ts < openAt) {
        return new Response(rateBody, {
          status: 429,
          headers: {
            "Retry-After": String(openAt - ts),
            "Content-Type": "application/json",
          },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const first = await POST(leadRequest(PROD));
    assert.equal(first.status, 429);
    assert.equal(first.headers.get("retry-after"), "30");
    assert.equal(await first.text(), rateBody);

    nowMs += 10_000;
    const inside = await POST(leadRequest(PROD));
    assert.equal(inside.status, 429);
    assert.equal(inside.headers.get("retry-after"), "20");
    assert.equal(await inside.text(), rateBody);

    nowMs += 20_000;
    const again = await POST(leadRequest(PROD));
    assert.equal(again.status, 201);
    const payload = (await again.json()) as { ok?: boolean; email?: string };
    assert.equal(payload.ok, true);
    assertNoLeadPii(JSON.stringify(payload));
    assert.equal(calls.length, 3);
    assert.equal(calls[2].get("x-pd-ts"), String(Math.floor(nowMs / 1000)));
    assert.equal(calls[2].get("x-pd-client-ip"), RAW_IP);
    assert.equal(
      calls[2].get("x-pd-sig"),
      signature(String(Math.floor(nowMs / 1000)), RAW_IP)
    );
    assertLogsMasked();
  });

  it("does not forward a client-forged X-PD-Client-IP", async () => {
    const calls: Headers[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(outgoingHeaders(init));
      return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const seeded = new Headers({
      "X-PD-Client-IP": FORGED_IP,
      "X-PD-Ts": "1",
      "X-PD-Sig": "deadbeef",
      "X-PD-Note": EMAIL,
      "Content-Type": "application/json",
    });
    stripClientPdHeaders(seeded);
    assert.equal(seeded.get("x-pd-client-ip"), null);
    assert.equal(seeded.get("x-pd-note"), null);
    assert.equal(seeded.get("content-type"), "application/json");

    const res = await POST(
      leadRequest(PROD, {
        "x-real-ip": RAW_IP,
        "x-vercel-forwarded-for": "192.0.2.5",
        "x-forwarded-for": FORWARDED_FOR,
        "x-pd-client-ip": FORGED_IP,
        "x-pd-ts": "1",
        "x-pd-sig": "eeee",
        "x-pd-note": EMAIL,
      })
    );
    assert.equal(res.status, 201);
    assert.equal(calls.length, 1);
    const headers = calls[0];
    assert.equal(headers.get("x-pd-client-ip"), RAW_IP);
    assert.equal(headers.get("x-pd-client-ip") === FORGED_IP, false);
    for (const [key, value] of headers.entries()) {
      assert.equal(key.toLowerCase() === "x-pd-note", false);
      assert.equal(value.includes(FORGED_IP), false);
      assert.equal(value.includes(EMAIL), false);
      assert.equal(value.includes(FORWARDED_FOR), false);
    }
    assert.equal(headers.get("x-forwarded-for"), null);

    calls.length = 0;
    const fromVercelChain = await POST(
      leadRequest(PROD, {
        "x-real-ip": null,
        "x-vercel-forwarded-for": "203.0.113.50, 192.0.2.5",
        "x-forwarded-for": FORWARDED_FOR,
        "x-pd-client-ip": FORGED_IP,
      })
    );
    assert.equal(fromVercelChain.status, 201);
    assert.equal(calls[0].get("x-pd-client-ip"), "203.0.113.50");
    assert.equal(calls[0].get("x-pd-sig"), signature(calls[0].get("x-pd-ts") || "", "203.0.113.50"));
    assert.equal(logs.join("\n").includes("203.0.113.50"), false);

    calls.length = 0;
    const forwardedOnly = await POST(
      leadRequest(PROD, {
        "x-real-ip": null,
        "x-vercel-forwarded-for": null,
        "x-forwarded-for": FORWARDED_FOR,
        "x-pd-client-ip": FORGED_IP,
      })
    );
    assert.equal(forwardedOnly.status, 201);
    for (const [key, value] of calls[0].entries()) {
      assert.equal(key.toLowerCase().startsWith("x-pd-"), false, key);
      assert.equal(value.includes(FORWARDED_FOR), false);
      assert.equal(value.includes(FORGED_IP), false);
    }

    calls.length = 0;
    delete process.env.PD_BFF_SIGNING_SECRET;
    process.env.LEADS_IP_HMAC_SECRET = "old-secret";
    const unsigned = await POST(
      leadRequest(PROD, {
        "x-real-ip": RAW_IP,
        "x-pd-client-ip": FORGED_IP,
        "x-pd-ts": "1",
        "x-pd-sig": "deadbeef",
      })
    );
    assert.equal(unsigned.status, 201);
    for (const [key, value] of calls[0].entries()) {
      assert.equal(key.toLowerCase().startsWith("x-pd-"), false, key);
      assert.equal(value.includes(FORGED_IP), false);
      assert.equal(value.includes(RAW_IP), false);
    }
    assertLogsMasked();
  });

  it("masks addresses before they are logged", () => {
    assert.equal(maskIp(RAW_IP), MASKED_IP);
    assert.equal(maskIp("2001:db8:85a3::8a2e:370:7334"), "2001:db8:*");
    assert.equal(maskIp("2001:db8:85a3::8a2e:370:7334").includes("7334"), false);
  });
});

function storedCopies(needle: string): number {
  try {
    const raw = readFileSync(dataFilePath("leads.json"), "utf8");
    return raw.split(needle).length - 1;
  } catch {
    return 0;
  }
}

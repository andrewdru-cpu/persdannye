import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST } from "../app/api/leads/route.ts";
import { flags } from "./flags.ts";
import { dataFilePath } from "../lib/data-dir.ts";
import { previousSigningSecret } from "../lib/deploy-env.ts";
import {
  allowedOriginsFromEnv,
  bffSignatureMaterial,
  isAllowedOrigin,
  maskIp,
  signClientPayload,
  stripClientPdHeaders,
  trustedClientIp,
} from "../lib/lead-guard.ts";
import { buildPublicLeadBody } from "../lib/public-lead.ts";

const PROD = "https://persdannye.ru";
const PREVIEW = "https://persdannye.vercel.app";
const SECRET = "0123456789abcdef0123456789abcdef";
const RAW_IP = "203.0.113.10";
const MASKED_IP = "203.0.113.0";
const FORGED_IP = "198.51.100.99";
const FORWARDED_FOR = "198.51.100.8";
const IDEMPOTENCY = "22222222-2222-4222-8222-222222222222";
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
  "PD_BFF_SIGNING_SECRET_PREV",
  "LEADS_IP_HMAC_SECRET",
  "PARSER_API_BASE",
  "PARSER_API_URL",
  "PARSER_API_TOKEN",
  "PARSER_API_KEY",
  "PARSER_API_EMAIL",
  "PARSER_API_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "VERCEL_ENV",
  "PD_DEPLOY_ENV",
  "PD_COLLECTION_ENABLED",
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
  headers.set("idempotency-key", IDEMPOTENCY);
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

function forwardedLeadBody(): string {
  return JSON.stringify(
    buildPublicLeadBody({
      name: NAME,
      email: EMAIL,
      phone: PHONE,
      url: "https://example.com",
      checkId: lead.checkId,
      message: MESSAGE,
      source: "landing",
      marketingConsent: false,
    })
  );
}

function signature(ts: string, ip: string, body: string, secret = SECRET) {
  const hash = createHash("sha256").update(body, "utf8").digest("hex");
  const material = `${ts}\nPOST\n/public/lead\n${ip}\n${hash}`;
  return createHmac("sha256", secret).update(material).digest("hex");
}

describe("POST /api/leads", { concurrency: 1 }, () => {
  beforeEach(() => {
    restoreEnv = snapshotEnv();
    process.env.ALLOWED_ORIGINS = `${PROD},${PREVIEW}`;
    process.env.PD_BFF_SIGNING_SECRET = SECRET;
    delete process.env.PD_BFF_SIGNING_SECRET_PREV;
    delete process.env.LEADS_IP_HMAC_SECRET;
    process.env.PARSER_API_BASE = "https://parser.example";
    delete process.env.PARSER_API_URL;
    process.env.PARSER_API_TOKEN = "parser-token";
    delete process.env.PARSER_API_KEY;
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.VERCEL_ENV;
    delete process.env.PD_DEPLOY_ENV;
    process.env.PD_COLLECTION_ENABLED = "true";
    flags.show_site_legal = true;
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
    flags.show_site_legal = false;
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
    const frozen = 1_760_817_600_999;
    Date.now = () => frozen;
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
    assert.equal(calls[0].url, "https://parser.example/public/lead");
    const headers = outgoingHeaders(calls[0].init);
    const ts = headers.get("x-pd-ts") || "";
    assert.match(ts, /^\d+$/);
    assert.equal(Number.isInteger(Number(ts)), true);
    assert.equal(ts, String(Math.floor(frozen / 1000)));
    assert.equal(ts, "1760817600");
    assert.equal(headers.get("x-pd-client-ip"), RAW_IP);
    const sentBody = String(calls[0].init.body);
    assert.equal(sentBody, forwardedLeadBody());
    assert.equal(headers.get("x-pd-sig"), signature(ts, RAW_IP, sentBody));
    assert.equal(headers.get("x-pd-sig"), signClientPayload(ts, "POST", "/public/lead", RAW_IP, SECRET, sentBody));
    const vercelPath = createHmac("sha256", SECRET)
      .update(`${ts}\nPOST\n/api/leads\n${RAW_IP}\n${createHash("sha256").update(sentBody, "utf8").digest("hex")}`)
      .digest("hex");
    assert.notEqual(headers.get("x-pd-sig"), vercelPath);
    assert.equal(headers.get("x-pd-client-ts"), null);
    assert.equal(headers.get("x-pd-client-sig"), null);
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("idempotency-key"), IDEMPOTENCY);
    const forwardedBody = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    assert.equal(forwardedBody.smart_token, undefined);
    assert.deepEqual(forwardedBody.consent, { accepted: true, text_version: "2026-10-11-lead" });
    assert.equal("marketing_consent" in forwardedBody, false);
    assert.equal(forwardedBody.check_id, lead.checkId);
    assert.equal(forwardedBody.email, EMAIL);
    assert.equal(forwardedBody.phone, PHONE);
    assert.equal(forwardedBody.name, NAME);
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
      signature(String(Math.floor(nowMs / 1000)), RAW_IP, forwardedLeadBody())
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
    assert.equal(calls[0].get("x-pd-sig"), signature(calls[0].get("x-pd-ts") || "", "203.0.113.50", forwardedLeadBody()));
    assert.equal(logs.join("\n").includes("203.0.113.50"), false);

    calls.length = 0;
    const spoofedChain = "198.51.100.8, 203.0.113.77";
    const forwardedOnly = await POST(
      leadRequest(PROD, {
        "x-real-ip": null,
        "x-vercel-forwarded-for": null,
        "x-forwarded-for": spoofedChain,
        "x-pd-client-ip": FORGED_IP,
        forwarded: "for=203.0.113.77",
      })
    );
    assert.equal(forwardedOnly.status, 201);
    assert.equal(trustedClientIp(new Headers({ "x-forwarded-for": spoofedChain, "x-pd-client-ip": FORGED_IP })), null);
    for (const [key, value] of calls[0].entries()) {
      assert.equal(key.toLowerCase().startsWith("x-pd-"), false, key);
      assert.equal(value.includes(FORWARDED_FOR), false);
      assert.equal(value.includes("203.0.113.77"), false);
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

  it("matches the parser example with an independent HMAC", () => {
    const empty = createHash("sha256").update("").digest("hex");
    const material = bffSignatureMaterial("1760817600", "post", "/public/lead", "203.0.113.7");
    assert.equal(material, `1760817600\nPOST\n/public/lead\n203.0.113.7\n${empty}`);
    const expected = createHmac("sha256", SECRET).update(`1760817600\nPOST\n/public/lead\n203.0.113.7\n${empty}`).digest("hex");
    assert.equal(signClientPayload("1760817600", "POST", "/public/lead", "203.0.113.7", SECRET), expected);
  });

  it("matches the published v2 signature vectors", () => {
    const key = "test-key-0123456789abcdef0123456789abcdef";
    const ts = "1700000000";
    const emptyMessage = bffSignatureMaterial(ts, "POST", "/public/lead", RAW_IP);
    assert.equal(
      emptyMessage,
      `1700000000\nPOST\n/public/lead\n203.0.113.10\n${createHash("sha256").update("").digest("hex")}`
    );
    assert.equal(signClientPayload(ts, "POST", "/public/lead", RAW_IP, key), "7e6b604153f10ada26d35f39a4b91cf2b16a5ceb55a0c9745f214e8f7b69e98a");
    const named = '{"name":"Test"}';
    assert.equal(Buffer.byteLength(named, "utf8"), 15);
    assert.equal(
      signClientPayload(ts, "POST", "/public/lead", RAW_IP, key, named),
      "1810e470f8492479571d2a4b9d324cf2e6a821bf2767390680925d048a40f0c9"
    );
    assert.notEqual(
      signClientPayload(ts, "POST", "/public/lead", RAW_IP, key),
      signClientPayload(ts, "POST", "/public/lead", RAW_IP, key, named)
    );
    assert.equal(previousSigningSecret(), null);
  });

  it("sends v2 X-PD-Ts, X-PD-Client-IP, and X-PD-Sig for the forwarded lead body", async () => {
    const key = "test-key-0123456789abcdef0123456789abcdef";
    Date.now = () => 1_700_000_000_000;
    process.env.PD_BFF_SIGNING_SECRET = key;
    process.env.PD_BFF_SIGNING_SECRET_PREV = "prev-key-0123456789abcdef0123456789abcdef";
    assert.equal(previousSigningSecret(), "prev-key-0123456789abcdef0123456789abcdef");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const res = await POST(leadRequest(PROD));
    assert.equal(res.status, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://parser.example/public/lead");
    assert.equal(calls[0].url.includes("/api/leads"), false);
    const headers = outgoingHeaders(calls[0].init);
    assert.equal(headers.get("x-pd-ts"), "1700000000");
    assert.equal(headers.get("x-pd-client-ip"), RAW_IP);
    const sentBody = String(calls[0].init.body);
    assert.equal(headers.get("x-pd-sig"), signature(headers.get("x-pd-ts") || "", RAW_IP, sentBody, key));
    const prevSig = createHmac("sha256", "prev-key-0123456789abcdef0123456789abcdef")
      .update(bffSignatureMaterial("1700000000", "POST", "/public/lead", RAW_IP, sentBody))
      .digest("hex");
    assert.notEqual(headers.get("x-pd-sig"), prevSig);
    assert.equal(headers.get("idempotency-key"), IDEMPOTENCY);
  });

  it("forwards one Idempotency-Key on a manual retry of the same lead", async () => {
    const keys: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get("idempotency-key") || "");
      return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      });
    }) as typeof fetch;
    const first = await POST(leadRequest(PROD));
    const second = await POST(leadRequest(PROD));
    assert.equal(first.status, 503);
    assert.equal(second.status, 503);
    assert.deepEqual(keys, [IDEMPOTENCY, IDEMPOTENCY]);
  });

  it("rejects a missing or invalid Idempotency-Key before calling the parser", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 201 });
    }) as typeof fetch;
    for (const key of [null, "", "not-a-uuid", "22222222-2222-4222-8222-22222222222"]) {
      const res = await POST(leadRequest(PROD, { "idempotency-key": key }));
      assert.equal(res.status, 400, String(key));
      assert.deepEqual(await res.json(), { error: "idempotency_key_invalid" });
    }
    assert.equal(calls, 0);
  });

  it("forwards the Idempotency-Key unchanged and omits marketing consent without an email", async () => {
    const key = "ABCDEFAB-1234-4678-9ABC-DEF012345678";
    const calls: Array<{ init: RequestInit }> = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ init: init ?? {} });
      return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const phoneOnly = await POST(
      leadRequest(
        PROD,
        { "idempotency-key": key },
        { ...lead, email: "", marketing_consent: true, marketing_consent_text_version: "client-version" }
      )
    );
    assert.equal(phoneOnly.status, 201);
    assert.equal(outgoingHeaders(calls[0].init).get("idempotency-key"), key);
    const phoneBody = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    assert.equal("email" in phoneBody, false);
    assert.equal("marketing_consent" in phoneBody, false);
    assert.equal("smart_token" in phoneBody, false);

    calls.length = 0;
    const withMail = await POST(
      leadRequest(PROD, { "idempotency-key": key }, { ...lead, phone: "", marketing_consent: true })
    );
    assert.equal(withMail.status, 201);
    const mailBody = JSON.parse(String(calls[0].init.body)) as {
      marketing_consent?: { accepted: boolean; text_version: string };
      phone?: string;
    };
    assert.deepEqual(mailBody.marketing_consent, {
      accepted: true,
      text_version: "2026-10-11-marketing",
    });
    assert.equal(mailBody.phone, undefined);
  });

  it("passes parser lead errors through and does not retry 503", async () => {
    const cases: Array<{ status: number; body: string; retry?: string }> = [
      { status: 400, body: JSON.stringify({ error: "validation_failed", fields: { email: "invalid" }, email: EMAIL }) },
      { status: 409, body: JSON.stringify({ error: "idempotency_in_progress", detail: EMAIL }) },
      { status: 422, body: JSON.stringify({ error: "idempotency_key_reused" }) },
      { status: 422, body: JSON.stringify({ error: "consent_required" }) },
      { status: 422, body: JSON.stringify({ error: "consent_version_unknown" }) },
      { status: 503, body: JSON.stringify({ error: "rate_limit_unavailable", detail: EMAIL }), retry: "9" },
    ];
    for (const item of cases) {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls += 1;
        return new Response(item.body, {
          status: item.status,
          headers: {
            "Content-Type": "application/json",
            ...(item.retry ? { "Retry-After": item.retry } : {}),
            "X-Should-Not-Leak": EMAIL,
          },
        });
      }) as typeof fetch;
      const before = storedCopies(EMAIL);
      const res = await POST(leadRequest(PROD));
      assert.equal(res.status, item.status);
      assert.equal(calls, 1, String(item.status));
      assert.equal(res.headers.get("x-should-not-leak"), null);
      const payload = (await res.json()) as { error?: string; fields?: Record<string, string>; detail?: string; email?: string };
      const upstream = JSON.parse(item.body) as { error: string; fields?: Record<string, string> };
      assert.equal(payload.error, upstream.error);
      if (upstream.fields) assert.deepEqual(payload.fields, upstream.fields);
      assert.equal(payload.detail, undefined);
      assert.equal(payload.email, undefined);
      assertNoLeadPii(JSON.stringify(payload));
      assert.equal(storedCopies(EMAIL), before);
      if (item.status === 503) assert.equal(res.headers.get("retry-after"), "9");
    }
  });

  it("forwards Redis 503 rate_limit_unavailable with Retry-After 30 and does not retry", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ error: "rate_limit_unavailable", detail: EMAIL }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30",
          "X-Should-Not-Leak": EMAIL,
        },
      });
    }) as typeof fetch;

    const before = storedCopies(EMAIL);
    const res = await POST(leadRequest(PROD));
    assert.equal(res.status, 503);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://parser.example/public/lead");
    assert.equal(calls[0].url.includes("/api/leads"), false);
    const headers = outgoingHeaders(calls[0].init);
    assert.equal(headers.get("idempotency-key"), IDEMPOTENCY);
    assert.equal(res.headers.get("retry-after"), "30");
    assert.equal(res.headers.get("x-should-not-leak"), null);
    assert.deepEqual(await res.json(), { error: "rate_limit_unavailable" });
    assert.equal(storedCopies(EMAIL), before);
    assertLogsMasked();
  });

  it("rejects a lead body larger than 16KB", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 201 });
    }) as typeof fetch;
    const res = await POST(leadRequest(PROD, undefined, { ...lead, padding: "a".repeat(17_000) }));
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "validation_failed" });
    assert.equal(calls, 0);
  });

  it("does not call the parser in production when the signing secret is unusable", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 201 });
    }) as typeof fetch;
    for (const [envName, secret] of [
      ["VERCEL_ENV", ""],
      ["VERCEL_ENV", "a".repeat(31)],
      ["PD_DEPLOY_ENV", ""],
      ["PD_DEPLOY_ENV", "b".repeat(31)],
    ] as const) {
      calls = 0;
      delete process.env.VERCEL_ENV;
      delete process.env.PD_DEPLOY_ENV;
      delete process.env.PD_BFF_SIGNING_SECRET;
      if (envName === "VERCEL_ENV") process.env.VERCEL_ENV = "production";
      else process.env.PD_DEPLOY_ENV = "prod";
      if (secret) process.env.PD_BFF_SIGNING_SECRET = secret;
      const res = await POST(leadRequest(PROD));
      assert.equal(res.status, 503, `${envName}:${secret.length}`);
      const text = await res.text();
      assert.equal(text.includes("PD_BFF"), false);
      assert.equal(text.includes("secret"), false);
      assert.equal(text.includes(SECRET), false);
      assertNoLeadPii(text);
      assert.equal(calls, 0);
    }

    delete process.env.VERCEL_ENV;
    delete process.env.PD_DEPLOY_ENV;
    process.env.PD_BFF_SIGNING_SECRET = "c".repeat(31);
    const dev = await POST(leadRequest(PROD));
    assert.equal(dev.status, 201);
    assert.equal(calls, 1);

    process.env.VERCEL_ENV = "production";
    process.env.PD_BFF_SIGNING_SECRET = SECRET;
    calls = 0;
    const signed: Headers[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      signed.push(outgoingHeaders(init));
      return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const prod = await POST(leadRequest(PROD));
    assert.equal(prod.status, 201);
    assert.equal(calls, 1);
    assert.equal(signed[0].get("x-pd-sig"), signature(signed[0].get("x-pd-ts") || "", RAW_IP, forwardedLeadBody()));
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

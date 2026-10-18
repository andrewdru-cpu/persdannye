import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LEAD_UNAVAILABLE_MESSAGE, leadUnavailableMessage, submitLeadOnce } from "../lib/lead-submit.ts";

const KEY = "33333333-3333-4333-8333-333333333333";
const payload = {
  name: "Анна",
  email: "anna@example.com",
  phone: "+79990001122",
  url: "https://example.com",
  message: "Нужен разбор",
  consent: true,
  consent_text_version: "2026-10-11-lead",
  marketing_consent: false,
};

function unavailable(retryAfter?: string) {
  return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    },
  });
}

describe("lead form submit", () => {
  it("shows the plain 503 text and does not send a second request", async () => {
    assert.equal(
      LEAD_UNAVAILABLE_MESSAGE,
      "Не удалось отправить заявку, попробуйте через несколько минут"
    );
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return unavailable();
    }) as typeof fetch;
    const result = await submitLeadOnce(payload, KEY, fetchImpl);
    assert.deepEqual(result, { ok: false, message: LEAD_UNAVAILABLE_MESSAGE });
    assert.equal(calls, 1);
  });

  it("shows minutes from Retry-After seconds or an HTTP-date and still sends once", async () => {
    const now = Date.parse("2026-10-18T20:00:00.000Z");
    assert.equal(leadUnavailableMessage("120", now), "Не удалось отправить заявку, попробуйте через ~2 мин");
    assert.equal(
      leadUnavailableMessage(new Date(now + 180_000).toUTCString(), now),
      "Не удалось отправить заявку, попробуйте через ~3 мин"
    );
    assert.equal(leadUnavailableMessage(null, now), LEAD_UNAVAILABLE_MESSAGE);

    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return unavailable("120");
    }) as typeof fetch;
    const result = await submitLeadOnce(payload, KEY, fetchImpl);
    assert.deepEqual(result, {
      ok: false,
      message: "Не удалось отправить заявку, попробуйте через ~2 мин",
    });
    assert.equal(calls, 1);

    const dated = new Date(Date.now() + 125_000).toUTCString();
    calls = 0;
    const datedFetch = (async () => {
      calls += 1;
      return unavailable(dated);
    }) as typeof fetch;
    const datedResult = await submitLeadOnce(payload, KEY, datedFetch);
    assert.deepEqual(datedResult, {
      ok: false,
      message: "Не удалось отправить заявку, попробуйте через ~3 мин",
    });
    assert.equal(calls, 1);
  });

  it("shows ~1 мин for Redis 503 Retry-After 30, keeps the payload, and does not retry", async () => {
    assert.equal(leadUnavailableMessage("30"), "Не удалось отправить заявку, попробуйте через ~1 мин");
    const calls: Array<{ key: string | null; body: string }> = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ key: headers.get("idempotency-key"), body: String(init?.body ?? "") });
      return unavailable("30");
    }) as typeof fetch;

    const result = await submitLeadOnce(payload, KEY, fetchImpl);
    assert.deepEqual(result, {
      ok: false,
      message: "Не удалось отправить заявку, попробуйте через ~1 мин",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].key, KEY);
    assert.deepEqual(JSON.parse(calls[0].body), payload);
  });

  it("reuses the idempotency key on a manual resubmit", async () => {
    const calls: Array<{ key: string | null; body: string }> = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ key: headers.get("idempotency-key"), body: String(init?.body ?? "") });
      return unavailable();
    }) as typeof fetch;

    const first = await submitLeadOnce(payload, KEY, fetchImpl);
    const second = await submitLeadOnce(payload, KEY, fetchImpl);
    assert.deepEqual(first, { ok: false, message: LEAD_UNAVAILABLE_MESSAGE });
    assert.deepEqual(second, { ok: false, message: LEAD_UNAVAILABLE_MESSAGE });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].key, KEY);
    assert.equal(calls[1].key, KEY);
    assert.equal(calls[0].body, calls[1].body);
  });

  it("keeps typed values and does not retry from the form", () => {
    const form = readFileSync(new URL("../components/landing/LeadForm.tsx", import.meta.url), "utf8");
    assert.match(form, /const \[idempotencyKey\] = useState\(\(\) => crypto\.randomUUID\(\)\)/);
    assert.match(form, /submitLeadOnce\(/);
    assert.equal(form.includes("fetch("), false);
    assert.equal(form.includes('setName("")'), false);
    assert.equal(form.includes('setEmail("")'), false);
    assert.equal(form.includes('setPhone("")'), false);
    assert.equal(form.includes('setUrl("")'), false);
    assert.equal(form.includes('setMessage("")'), false);
    assert.match(form, /if \(!result\.ok\) \{\s*setStatus\("error"\);\s*setError\(result\.message\);/);
  });
});

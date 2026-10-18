import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LEAD_UNAVAILABLE_MESSAGE, submitLeadOnce } from "../lib/lead-submit.ts";

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

describe("lead form submit", () => {
  it("shows the 503 message once and reuses the idempotency key", async () => {
    assert.equal(
      LEAD_UNAVAILABLE_MESSAGE,
      "Не удалось отправить заявку, попробуйте через несколько минут"
    );
    const calls: Array<{ key: string | null; body: string }> = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ key: headers.get("idempotency-key"), body: String(init?.body ?? "") });
      return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      });
    }) as typeof fetch;

    const first = await submitLeadOnce(payload, KEY, fetchImpl);
    const second = await submitLeadOnce(payload, KEY, fetchImpl);
    assert.deepEqual(first, { ok: false, message: LEAD_UNAVAILABLE_MESSAGE });
    assert.deepEqual(second, { ok: false, message: LEAD_UNAVAILABLE_MESSAGE });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].key, KEY);
    assert.equal(calls[1].key, KEY);
    assert.equal(calls[0].body, calls[1].body);
    assert.equal(calls[0].body.includes(payload.email), true);
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

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flags } from "../content/flags";
import { leadConsent } from "../content/consents";
import { fillPlaceholders } from "../content/placeholders";
import {
  DIRECT_LEAD_CONSENT_TEXT_VERSION,
  DIRECT_MARKETING_CONSENT_TEXT_VERSION,
  LEAD_CONSENT_TEXT_VERSION,
  MARKETING_CONSENT_TEXT_VERSION,
} from "../lib/consent";
import { createMockPublicApi } from "../scripts/mock-public-api.mjs";
import {
  buildPublicLeadBody,
  createIdempotencyKey,
  createPublicLead,
  isIdempotencyKey,
  PublicApiError,
} from "../lib/public-api";

const root = path.resolve(import.meta.dirname, "..");

const baseLead = {
  name: "Анна",
  consentAccepted: true,
  smartToken: "tok",
};

test("direct lead sends marketing_consent only with email and a checked box", () => {
  const phoneOnly = buildPublicLeadBody({ ...baseLead, phone: "+79990001122" });
  assert.equal("email" in phoneOnly, false);
  assert.equal("marketing_consent" in phoneOnly, false);
  assert.equal("company" in phoneOnly, false);
  assert.deepEqual(phoneOnly.consent, {
    accepted: true,
    text_version: DIRECT_LEAD_CONSENT_TEXT_VERSION,
  });

  const emailUnchecked = buildPublicLeadBody({
    ...baseLead,
    email: "anna@example.com",
    marketingAccepted: false,
    company: "ООО Ромашка",
  });
  assert.equal(emailUnchecked.email, "anna@example.com");
  assert.equal("marketing_consent" in emailUnchecked, false);
  assert.equal("company" in emailUnchecked, false);

  const emailChecked = buildPublicLeadBody({
    ...baseLead,
    email: "anna@example.com",
    phone: "+79990001122",
    marketingAccepted: true,
  });
  assert.deepEqual(emailChecked.marketing_consent, {
    accepted: true,
    text_version: "2026-10-11-marketing",
  });
  assert.equal(
    (emailChecked.marketing_consent as { text_version: string }).text_version,
    DIRECT_MARKETING_CONSENT_TEXT_VERSION
  );
  assert.notEqual(DIRECT_MARKETING_CONSENT_TEXT_VERSION, LEAD_CONSENT_TEXT_VERSION);
  assert.equal(MARKETING_CONSENT_TEXT_VERSION, "2026-10-11-marketing");
  assert.equal((emailChecked.consent as { text_version: string }).text_version, "2026-10-11-lead");
});

test("direct lead rejects a contact-less payload before the network", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    throw new Error("fetch should not run");
  };
  await assert.rejects(
    () => createPublicLead({ ...baseLead, smartToken: "tok" }, fetchImpl),
    (err: unknown) =>
      err instanceof PublicApiError &&
      err.code === "validation_failed" &&
      err.fields?.includes("email") === true &&
      err.fields?.includes("phone") === true
  );
  assert.equal(calls, 0);
});

test("idempotency key is a uuid v4 and stays the same across retryable failures", async () => {
  const key = createIdempotencyKey();
  assert.equal(isIdempotencyKey(key), true);
  const previous = process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "https://api.example.ru";
  const seen: string[] = [];
  const credentials: Array<RequestCredentials | undefined> = [];
  let calls = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls += 1;
    seen.push(new Headers(init?.headers).get("Idempotency-Key") || "");
    credentials.push(init?.credentials);
    if (calls === 1) throw new Error("network");
    if (calls === 2) return Response.json({ error: "idempotency_in_progress" }, { status: 409 });
    return Response.json({ ok: true, id: "lead-1" }, { status: 201 });
  };
  try {
    const result = await createPublicLead(
      { ...baseLead, phone: "+79990001122", idempotencyKey: key },
      fetchImpl
    );
    assert.equal(result.id, "lead-1");
    assert.deepEqual(seen, [key, key, key]);
    assert.deepEqual(credentials, ["omit", "omit", "omit"]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
    else process.env.NEXT_PUBLIC_PUBLIC_API_BASE = previous;
  }
});

test("429 is not retried and 422 rotates responsibility to the caller", async () => {
  const previousBase = process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "https://api.example.ru";
  let limited = 0;
  try {
  await assert.rejects(
    () =>
      createPublicLead({ ...baseLead, email: "a@b.c", smartToken: "limit" }, async () => {
        limited += 1;
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Retry-After": "1" },
        });
      }),
    (err: unknown) => err instanceof PublicApiError && err.code === "rate_limited" && err.retryAfter === 1
  );
  assert.equal(limited, 1);
  } finally {
    if (previousBase === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
    else process.env.NEXT_PUBLIC_PUBLIC_API_BASE = previousBase;
  }

  const mock = createMockPublicApi();
  const origin = await mock.listen();
  const previous = process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = origin;
  const key = createIdempotencyKey();
  try {
    await createPublicLead({
      ...baseLead,
      email: "a@b.c",
      message: "первый",
      idempotencyKey: key,
    });
    await assert.rejects(
      () =>
        createPublicLead({
          ...baseLead,
          email: "a@b.c",
          message: "второй",
          idempotencyKey: key,
        }),
      (err: unknown) => err instanceof PublicApiError && err.code === "idempotency_key_reused"
    );
    const next = createIdempotencyKey();
    const created = await createPublicLead({
      ...baseLead,
      email: "a@b.c",
      message: "второй",
      idempotencyKey: next,
    });
    assert.equal(created.ok, true);
    assert.notEqual(next, key);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
    else process.env.NEXT_PUBLIC_PUBLIC_API_BASE = previous;
    await mock.close();
  }
});

test("mock covers captcha, validation, and in-progress retries with one key", async () => {
  const mock = createMockPublicApi();
  const origin = await mock.listen();
  const previous = process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = origin;
  try {
    await assert.rejects(
      () => createPublicLead({ ...baseLead, email: "a@b.c", smartToken: "bad" }),
      (err: unknown) => err instanceof PublicApiError && err.status === 403 && err.code === "captcha_failed"
    );
    await assert.rejects(
      () => createPublicLead({ ...baseLead, email: "a@b.c", smartToken: "origin" }),
      (err: unknown) => err instanceof PublicApiError && err.code === "origin_forbidden"
    );
    const busy = await createPublicLead({ ...baseLead, phone: "123", smartToken: "busy" });
    assert.equal(busy.ok, true);
    const busyCalls = mock.requests.filter(
      (item: { path: string; body: { smart_token?: string } }) =>
        item.path === "/public/lead" && item.body?.smart_token === "busy"
    );
    assert.equal(busyCalls.length, 2);
    assert.equal(busyCalls[0].idempotencyKey, busyCalls[1].idempotencyKey);

    const down = await createPublicLead({ ...baseLead, email: "a@b.c", smartToken: "unavailable" });
    assert.equal(typeof down.id, "string");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
    else process.env.NEXT_PUBLIC_PUBLIC_API_BASE = previous;
    await mock.close();
  }
});

test("lead form checkboxes start unchecked and marketing waits for an email", () => {
  const form = fs.readFileSync(path.join(root, "components/landing/LeadForm.tsx"), "utf8");
  assert.equal(form.includes("defaultChecked"), false);
  assert.equal((form.match(/useState\(false\)/g) || []).length >= 2, true);
  assert.match(form, /disabled=\{!consent/);
  assert.match(form, /direct \? mail\.length > 0 : marketingConsent/);
  assert.match(form, /if \(!mail\) setMarketingOptIn\(false\)/);
  assert.match(form, /marketingAccepted: mail\.length > 0 && marketingOptIn/);
  assert.match(form, /Как мы обрабатываем данные — в/);
  assert.match(form, /href="\/privacy"/);
  assert.equal(form.includes("Политике"), true);
  assert.equal(form.includes("Компания"), false);
  assert.equal(form.includes("company"), false);
  assert.equal(form.includes('consentHref="/consent-lead"'), true);
});

test("consent-lead stays unpublished while show_site_legal is off and keeps unknown markers", () => {
  assert.equal(flags.show_site_legal, false);
  const page = fs.readFileSync(path.join(root, "app/consent-lead/page.tsx"), "utf8");
  const guard = page.indexOf("if (!flags.show_site_legal)");
  const copy = page.indexOf("leadConsent.paragraphs");
  assert.ok(guard > 0 && copy > guard);
  assert.match(page, /index:\s*false/);
  assert.equal(page.includes("LegalPending"), true);
  assert.equal(page.slice(0, copy).includes("действуя свободно"), false);

  assert.equal(leadConsent.title, "Согласие на обработку персональных данных (заявка)");
  assert.equal(
    leadConsent.paragraphs[0],
    "Я, действуя свободно, своей волей и в своём интересе, отмечая чекбокс в форме заявки на {{operator_site}}, даю согласие {{operator_full_name}} (ИНН {{operator_inn}}, ОГРН/ОГРНИП {{operator_ogrn}}, адрес: {{operator_address}}) (далее — Оператор) на обработку моих персональных данных на следующих условиях."
  );
  assert.equal(
    leadConsent.points[7],
    "Порядок обработки описан в [Политике обработки персональных данных]({{policy_url}})."
  );
  const processors = fillPlaceholders(leadConsent.points[3], false, true);
  assert.match(processors, /\{\{processor_timeweb_legal\}\}/);
  assert.match(processors, /\{\{processor_yandex360_legal\}\}/);
  assert.equal(fillPlaceholders("{{processor_timeweb_legal}}", false), "");
});

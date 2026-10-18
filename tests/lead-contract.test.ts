import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flags } from "../content/flags";
import { marketingConsentEnabled } from "../lib/runtime-flags";
import {
  DIRECT_LEAD_CONSENT_FILE,
  DIRECT_LEAD_CONSENT_TEXT_VERSION,
  DIRECT_MARKETING_CONSENT_FILE,
  DIRECT_MARKETING_CONSENT_TEXT_VERSION,
  LEAD_CONSENT_TEXT_VERSION,
  MARKETING_CONSENT_TEXT_VERSION,
} from "../lib/consent";
import {
  LEAD_CONSENT_PATH,
  leadConsentDocument,
  leadConsentProductionValues,
  publishLeadConsent,
  readLeadConsentSource,
  renderLeadConsent,
  UnresolvedConsentError,
} from "../lib/lead-consent";
import { createMockPublicApi } from "../scripts/mock-public-api.mjs";
import { leadMarketingDecision } from "../lib/lead-marketing";
import {
  buildPublicLeadBody,
  createIdempotencyKey,
  createPublicLead,
  isIdempotencyKey,
  leadFailurePresentation,
  PublicApiError,
  readRetryAfter,
  retryAfterLabel,
  withRetryHint,
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
    (err: unknown) => {
      assert.ok(err instanceof PublicApiError);
      assert.equal(err.code, "rate_limited");
      assert.equal(err.retryAfter, 1);
      assert.equal(retryAfterLabel(err.retryAfter), "1 с");
      assert.match(withRetryHint(err.message, err.retryAfter), /Повторите через 1 с/);
      return true;
    }
  );
  assert.equal(limited, 1);
  assert.equal(readRetryAfter("7200"), 7200);
  assert.equal(retryAfterLabel(90), "2 мин");
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

    await assert.rejects(
      () => createPublicLead({ ...baseLead, email: "a@b.c", smartToken: "unavailable" }),
      (err: unknown) =>
        err instanceof PublicApiError &&
        err.status === 503 &&
        err.code === "captcha_unavailable" &&
        err.retryAfter === 180 &&
        err.message === "Проверка временно недоступна. Попробуйте ещё раз."
    );
    const captchaCalls = mock.requests.filter(
      (item: { path: string; body: { smart_token?: string } }) =>
        item.path === "/public/lead" && item.body?.smart_token === "unavailable"
    );
    assert.equal(captchaCalls.length, 1);
    const shown = leadFailurePresentation({
      message: "Проверка временно недоступна. Попробуйте ещё раз.",
      code: "captcha_unavailable",
      retryAfter: 180,
    });
    assert.equal(shown.resetCaptcha, true);
    assert.equal(shown.keepFields, true);
    assert.equal(shown.message, "Проверка временно недоступна. Попробуйте ещё раз. Повторите через 3 мин.");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
    else process.env.NEXT_PUBLIC_PUBLIC_API_BASE = previous;
    await mock.close();
  }
});

test("clearing the email resets the marketing checkbox and omits marketing_consent", () => {
  assert.equal(flags.show_marketing_consent, false);
  assert.equal(flags.show_site_legal, false);
  assert.equal(fs.existsSync(path.join(root, "content/consents", DIRECT_MARKETING_CONSENT_FILE)), false);
  const hidden = leadMarketingDecision(false, "anna@example.com", true);
  assert.equal(hidden.visible, false);
  assert.equal(hidden.checked, false);
  assert.equal(hidden.send, false);

  const typed = leadMarketingDecision(true, "anna@example.com", false);
  assert.equal(typed.visible, true);
  assert.equal(typed.send, false);
  const marked = leadMarketingDecision(true, "anna@example.com", true);
  assert.equal(marked.visible, true);
  assert.equal(marked.checked, true);
  assert.equal(marked.send, true);
  const sent = buildPublicLeadBody({
    ...baseLead,
    email: "anna@example.com",
    marketingAccepted: marked.send,
  });
  assert.deepEqual(sent.marketing_consent, {
    accepted: true,
    text_version: DIRECT_MARKETING_CONSENT_TEXT_VERSION,
  });

  const cleared = leadMarketingDecision(true, "   ", true);
  assert.equal(cleared.visible, false);
  assert.equal(cleared.checked, false);
  assert.equal(cleared.send, false);
  const after = buildPublicLeadBody({
    ...baseLead,
    phone: "+79990001122",
    marketingAccepted: cleared.send,
  });
  assert.equal("email" in after, false);
  assert.equal("marketing_consent" in after, false);
});

test("marketing checkbox and marketing_consent follow all four flag combinations", () => {
  assert.equal(flags.show_site_legal, false);
  assert.equal(flags.show_marketing_consent, false);
  const cases = [
    { legal: false, marketing: false },
    { legal: false, marketing: true },
    { legal: true, marketing: false },
    { legal: true, marketing: true },
  ] as const;
  for (const item of cases) {
    const allowed = marketingConsentEnabled(item.legal, item.marketing);
    const decision = leadMarketingDecision(allowed, "anna@example.com", true);
    assert.equal(allowed, item.legal && item.marketing);
    assert.equal(decision.visible, allowed);
    assert.equal(decision.send, allowed);
    const checked = buildPublicLeadBody({
      ...baseLead,
      email: "anna@example.com",
      marketingAccepted: decision.send,
    });
    if (allowed) {
      assert.deepEqual(checked.marketing_consent, {
        accepted: true,
        text_version: DIRECT_MARKETING_CONSENT_TEXT_VERSION,
      });
    } else {
      assert.equal("marketing_consent" in checked, false);
    }
  }
  const bothOnUnchecked = buildPublicLeadBody({
    ...baseLead,
    email: "anna@example.com",
    marketingAccepted: marketingConsentEnabled(true, true) && false,
  });
  assert.equal("marketing_consent" in bothOnUnchecked, false);

  const previous = process.env.NEXT_PUBLIC_MARKETING_CONSENT;
  process.env.NEXT_PUBLIC_MARKETING_CONSENT = "true";
  try {
    assert.equal(marketingConsentEnabled(), false);
    assert.equal(marketingConsentEnabled(true), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MARKETING_CONSENT;
    else process.env.NEXT_PUBLIC_MARKETING_CONSENT = previous;
  }
});

test("e2e: 503 rate_limit_unavailable is not retried and the lead body stays", async () => {
  const mock = createMockPublicApi();
  const origin = await mock.listen();
  const previous = process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = origin;
  const draft = { ...baseLead, name: "Анна", email: "anna@example.com", message: "Нужен разбор" };
  try {
    await assert.rejects(
      () => createPublicLead({ ...draft, smartToken: "rate-down" }),
      (err: unknown) => {
        assert.ok(err instanceof PublicApiError);
        assert.equal(err.status, 503);
        assert.equal(err.code, "rate_limit_unavailable");
        assert.equal(err.retryAfter, 45);
        assert.equal(err.message, "Не удалось отправить заявку, попробуйте через несколько минут");
        const shown = leadFailurePresentation(err);
        assert.equal(shown.keepFields, true);
        assert.equal(shown.resetCaptcha, false);
        assert.equal(
          shown.message,
          "Не удалось отправить заявку, попробуйте через несколько минут. Повторите через 45 с."
        );
        return true;
      }
    );
    const calls = mock.requests.filter(
      (item: { path: string; body: { smart_token?: string; email?: string; message?: string } }) =>
        item.path === "/public/lead" && item.body?.smart_token === "rate-down"
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.email, draft.email);
    assert.equal(calls[0].body.message, draft.message);
    assert.equal(calls[0].body.name, draft.name);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_API_BASE;
    else process.env.NEXT_PUBLIC_PUBLIC_API_BASE = previous;
    await mock.close();
  }
});

const LEAD_CONSENT_SHA256 = "43f4d7cfb76f6ea92e1a692c7ba31e30bc6d2b1032cffabfbfc6fda9d984ce80";

test("consent-lead file is the approved text and the publish guard rejects leftover braces", () => {
  assert.equal(flags.show_site_legal, false);
  const consentDir = path.join(root, "content/consents");
  const names = fs.readdirSync(consentDir).filter((name) => name.endsWith(".md")).sort();
  const expected: Record<string, string> = {
    "2026-10-11-lead.md": LEAD_CONSENT_SHA256,
  };
  assert.deepEqual(names, Object.keys(expected).sort());
  for (const name of names) {
    const fileBytes = fs.readFileSync(path.join(consentDir, name));
    assert.equal(createHash("sha256").update(fileBytes).digest("hex"), expected[name], name);
  }
  const bytes = fs.readFileSync(LEAD_CONSENT_PATH);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), LEAD_CONSENT_SHA256);
  assert.equal(path.basename(LEAD_CONSENT_PATH), DIRECT_LEAD_CONSENT_FILE);
  const versioned = buildPublicLeadBody({
    ...baseLead,
    email: "anna@example.com",
    marketingAccepted: true,
  });
  assert.equal(
    (versioned.consent as { text_version: string }).text_version,
    path.basename(LEAD_CONSENT_PATH, ".md")
  );
  assert.equal(
    (versioned.consent as { text_version: string }).text_version,
    DIRECT_LEAD_CONSENT_TEXT_VERSION
  );
  assert.equal(
    (versioned.marketing_consent as { text_version: string }).text_version,
    path.basename(DIRECT_MARKETING_CONSENT_FILE, ".md")
  );
  const source = readLeadConsentSource();
  assert.equal(source, bytes.toString("utf8"));
  const blocks = leadConsentDocument(source);
  assert.equal(blocks[0]?.text, "Согласие на обработку персональных данных (заявка)");
  assert.equal(
    blocks.find((block) => block.type === "point" && block.text.includes("processor_timeweb_legal"))?.text,
    "**Лица, обрабатывающие данные по поручению Оператора:** {{processor_timeweb_legal}} (хостинг), {{processor_yandex360_legal}} (электронная почта)."
  );
  assert.equal(
    blocks.filter((block) => block.type === "point").at(-1)?.text,
    "Порядок обработки описан в [Политике обработки персональных данных]({{policy_url}})."
  );

  const values = leadConsentProductionValues();
  assert.equal("privacy_contact_email" in values, false);
  assert.equal("processor_timeweb_legal" in values, false);
  assert.equal("processor_yandex360_legal" in values, false);
  assert.equal(publishLeadConsent(false, source), null);
  assert.throws(() => publishLeadConsent(true, source), UnresolvedConsentError);

  const filled = renderLeadConsent(source, {
    ...values,
    processor_timeweb_legal: "ООО «Таймвэб»",
    processor_yandex360_legal: "ООО «Яндекс 360»",
    privacy_contact_email: "privacy@example.com",
  });
  assert.equal(filled.includes("{{"), false);
  assert.match(filled, /ООО «Таймвэб»/);
  assert.match(filled, /privacy@example.com/);
  assert.match(filled, /\]\(\/privacy\)/);
  assert.equal(leadConsentDocument(filled).filter((block) => block.type === "point").length, 8);

  const page = fs.readFileSync(path.join(root, "app/consent-lead/page.tsx"), "utf8");
  const call = page.indexOf("publishLeadConsent(flags.show_site_legal)");
  const pending = page.indexOf("<LegalPending");
  assert.ok(call > 0 && pending > call);
  assert.match(page, /index:\s*false/);
  assert.equal(page.includes("content/consents"), false);
  assert.equal(page.includes("leadConsent.paragraphs"), false);
  assert.equal(page.includes("действуя свободно"), false);
  assert.equal(page.includes("{{"), false);
});

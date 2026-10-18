import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { CONSENT_POLICY_LABEL, CONSENT_TEXT, CONSENT_TEXT_VERSION } from "../content/consent";
import { formCopy } from "../content/blocks";
import {
  DIRECT_LEAD_CONSENT_TEXT_VERSION,
  DIRECT_MARKETING_CONSENT_TEXT_VERSION,
  LEAD_CONSENT_TEXT_VERSION,
} from "../lib/consent";
import { createMockPublicApi } from "../scripts/mock-public-api.mjs";
import { rejectDirectModeBff } from "../lib/bff-guard";
import { checkForDisplay } from "../lib/check-view";
import { landingScanCreateBody, publicCheckJob, SITE_FORM_ORIGIN } from "../lib/parser-client";
import { normalizeScanContact } from "../lib/scan-contacts";
import { contentSecurityPolicy, SMARTCAPTCHA_ORIGINS } from "../lib/csp";
import { pollCheck, runCheck, runLead } from "../lib/forms-client";
import { getFormsMode } from "../lib/forms-mode";
import {
  buildPublicCheckBody,
  buildPublicLeadBody,
  createPublicCheck,
  getPublicCheck,
  joinPublicApi,
  mapPublicCheck,
  publicCheckPdfUrl,
  publicErrorMessage,
  PublicApiError,
} from "../lib/public-api";
import { publicCheckRecord, publicCheckResponseSchema } from "../lib/public-check-schema";
import { shouldLoadSmartCaptcha, SMARTCAPTCHA_SCRIPT_SRC } from "../lib/smartcaptcha";

const root = path.resolve(import.meta.dirname, "..");

function saveEnv(keys: string[]) {
  const prev = new Map<string, string | undefined>();
  for (const key of keys) prev.set(key, process.env[key]);
  return () => {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("consent version stays the persdannye#4 string and the client cannot replace it", async () => {
  assert.equal(CONSENT_TEXT_VERSION, "2026-10-11");
  assert.equal(
    CONSENT_TEXT,
    "Я даю согласие на обработку персональных данных в соответствии с Политикой обработки персональных данных"
  );
  assert.equal(CONSENT_TEXT.endsWith(CONSENT_POLICY_LABEL), true);
  assert.equal(LEAD_CONSENT_TEXT_VERSION, CONSENT_TEXT_VERSION);
  assert.equal(DIRECT_LEAD_CONSENT_TEXT_VERSION, "2026-10-11-lead");
  assert.equal(DIRECT_MARKETING_CONSENT_TEXT_VERSION, "2026-10-11-marketing");
  assert.notEqual(DIRECT_LEAD_CONSENT_TEXT_VERSION, LEAD_CONSENT_TEXT_VERSION);
  const checker = fs.readFileSync(path.join(root, "components/check/UrlChecker.tsx"), "utf8");
  const leadForm = fs.readFileSync(path.join(root, "components/landing/LeadForm.tsx"), "utf8");
  assert.equal(checker.includes("runCheck"), true);
  assert.equal(leadForm.includes('consentHref="/consent-lead"'), true);
  assert.equal(leadForm.includes("leadConsentTail"), true);
  assert.equal(formCopy.leadConsentTail, "для ответа на мою заявку");
  assert.equal(checker.includes("textVersion"), false);
  assert.equal(leadForm.includes("textVersion"), false);

  const forged = "1999-01-01";
  const check = buildPublicCheckBody({
    url: "example.ru",
    email: "a@b.c",
    consentAccepted: true,
    textVersion: forged,
    smartToken: "tok",
  });
  assert.equal((check.consent as { text_version: string }).text_version, CONSENT_TEXT_VERSION);
  assert.equal(JSON.stringify(check).includes(forged), false);

  const lead = buildPublicLeadBody({
    name: "Анна",
    email: "a@b.c",
    consentAccepted: true,
    textVersion: forged,
    smartToken: "tok",
  });
  assert.equal((lead.consent as { text_version: string }).text_version, DIRECT_LEAD_CONSENT_TEXT_VERSION);
  assert.equal("marketing_consent" in lead, false);
  assert.equal("company" in lead, false);

  const stored = normalizeScanContact({
    email: "a@b.c",
    consent: true,
    consent_text_version: forged,
  });
  assert.equal(stored?.consent_text_version, CONSENT_TEXT_VERSION);

  assert.equal(publicErrorMessage(422, { error: "consent_version_unknown" }), "Обновите страницу и повторите");
  assert.equal(
    publicErrorMessage(422, { detail: { code: "consent_version_unknown" } }),
    "Обновите страницу и повторите"
  );

  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE", "NEXT_PUBLIC_PUBLIC_API_BASE"]);
  process.env.NEXT_PUBLIC_FORMS_MODE = "direct";
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "http://127.0.0.1:9";
  const mock = createMockPublicApi();
  try {
    await assert.rejects(
      () =>
        createPublicCheck(
          {
            url: "https://example.ru",
            email: "a@b.c",
            consentAccepted: true,
            textVersion: forged,
            smartToken: "tok",
          },
          async () => Response.json({ error: "consent_version_unknown" }, { status: 422 })
        ),
      (err: unknown) => err instanceof PublicApiError && err.message === "Обновите страницу и повторите"
    );

    const origin = await mock.listen();
    const bad = await fetch(`${origin}/public/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.ru",
        smart_token: "tok",
        contacts: { email: "a@b.c" },
        consent: { accepted: true, text_version: forged },
      }),
    });
    assert.equal(bad.status, 422);
    assert.deepEqual(await bad.json(), { error: "consent_version_unknown" });
  } finally {
    restore();
    await mock.close();
  }
});

test("default forms mode is bff and does not load SmartCaptcha", () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE"]);
  delete process.env.NEXT_PUBLIC_FORMS_MODE;
  try {
    assert.equal(getFormsMode(), "bff");
    assert.equal(shouldLoadSmartCaptcha(), false);
  } finally {
    restore();
  }
});

test("bff check and lead still post to this site's /api routes", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE"]);
  delete process.env.NEXT_PUBLIC_FORMS_MODE;
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url === "/api/checks") {
      return Response.json(
        {
          id: "job-1",
          url: "https://example.ru/",
          domain: "example.ru",
          phase: "queued",
          phaseMessage: "queued",
          findings: [],
          hasRisks: false,
          createdAt: "t",
          updatedAt: "t",
          mock: true,
        },
        { status: 201 }
      );
    }
    return Response.json({ ok: true, id: "lead-1" }, { status: 201 });
  };
  try {
    await runCheck(
      {
        url: "example.ru",
        name: "Анна",
        email: "anna@example.com",
        phone: "+79990000000",
        consentAccepted: true,
        textVersion: "not-the-allowlist",
      },
      fetchImpl
    );
    await runLead(
      {
        name: "Анна",
        email: "anna@example.com",
        phone: "+79990000000",
        company: "ООО Ромашка",
        url: "https://example.ru",
        checkId: "job-1",
        message: "привет",
        source: "landing",
        consentAccepted: true,
        textVersion: "2026-10-11",
      },
      fetchImpl
    );
    assert.deepEqual(
      calls.map((call) => call.url),
      ["/api/checks", "/api/leads"]
    );
    assert.deepEqual(calls[0].body, {
      url: "example.ru",
      lead: {
        name: "Анна",
        email: "anna@example.com",
        phone: "+79990000000",
        consent: true,
        consent_text_version: "2026-10-11",
      },
    });
    assert.equal((calls[1].body as { consent: boolean }).consent, true);
    assert.equal((calls[1].body as { checkId: string }).checkId, "job-1");
    assert.equal("smart_token" in (calls[0].body as object), false);
  } finally {
    restore();
  }
});

test("direct mode sends PD only to /public/* and keeps report_url", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE", "NEXT_PUBLIC_PUBLIC_API_BASE"]);
  const mock = createMockPublicApi();
  const decoyHits: string[] = [];
  const decoy = http.createServer((req, res) => {
    decoyHits.push(req.url || "");
    res.writeHead(500);
    res.end("site api");
  });
  const origin = await mock.listen();
  await new Promise<void>((resolve) => decoy.listen(0, "127.0.0.1", () => resolve()));
  process.env.NEXT_PUBLIC_FORMS_MODE = "direct";
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = origin;
  const email = "visitor@example.com";
  try {
    assert.equal(shouldLoadSmartCaptcha(), true);
    const created = await runCheck({
      url: "example.ru",
      name: "Иван",
      email,
      phone: "+79991112233",
      consentAccepted: true,
      textVersion: "2026-10-11",
      smartToken: "captcha-token",
    });
    assert.equal(created.id.length, 64);
    assert.match(created.reportUrl || "", /\/r\/[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(created).includes(email), false);
    assert.equal("contact" in created, false);

    const polled = await pollCheck(created.id, created);
    const serialized = JSON.stringify(polled);
    assert.equal(serialized.includes(email), false);
    assert.equal(serialized.includes("SHOULD_NOT_RENDER"), false);
    assert.equal(serialized.includes("screenshot"), false);
    assert.equal(polled.reportUrl, created.reportUrl);
    assert.equal(polled.findings.length, 1);
    assert.deepEqual(Object.keys(polled.findings[0]).sort(), ["fact", "rule_id", "severity", "title"]);
    assert.equal(polled.findings[0].fact, "Документ по ст. 18.1 не найден. [контактные данные скрыты]");
    assert.equal(serialized.includes("7707083893"), false);
    assert.equal(serialized.includes("ООО Пример"), false);
    assert.equal("inn" in polled, false);
    assert.equal("org_name" in polled, false);
    assert.equal(publicCheckPdfUrl(created.id), `${origin}/public/check/${created.id}/pdf`);

    const pdf = await fetch(publicCheckPdfUrl(created.id));
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(await pdf.text(), /^%PDF/);

    await runLead({
      name: "Иван",
      email,
      phone: "+79991112233",
      company: "ООО Пример",
      url: "https://example.ru/",
      checkId: created.id,
      message: "нужен аудит",
      source: "check-result",
      consentAccepted: true,
      textVersion: "2026-10-11",
      smartToken: "captcha-token",
    });

    const paths = mock.requests.map((item: { path: string }) => item.path);
    assert.deepEqual(paths, ["/public/check", `/public/check/${created.id}`, `/public/check/${created.id}/pdf`, "/public/lead"]);
    assert.equal(paths.some((item: string) => item.startsWith("/api/")), false);
    assert.equal(decoyHits.length, 0);

    const checkBody = mock.requests[0].body as {
      smart_token: string;
      contacts: { email: string };
      consent: { accepted: boolean; text_version: string };
    };
    assert.equal(checkBody.smart_token, "captcha-token");
    assert.equal(checkBody.contacts.email, email);
    assert.deepEqual(checkBody.consent, { accepted: true, text_version: "2026-10-11" });

    const leadBody = mock.requests[3].body as {
      email: string;
      check_id: string;
      consent: { accepted: boolean; text_version: string };
    };
    assert.equal(leadBody.email, email);
    assert.equal(leadBody.check_id, created.id);
    assert.equal(leadBody.consent.accepted, true);
    assert.equal(leadBody.consent.text_version, "2026-10-11-lead");
    assert.equal("company" in leadBody, false);
    assert.equal("marketing_consent" in leadBody, false);
    assert.match(mock.requests[3].idempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  } finally {
    restore();
    await mock.close();
    await new Promise<void>((resolve) => decoy.close(() => resolve()));
  }
});

test("direct mode does not call the network without captcha or consent", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE", "NEXT_PUBLIC_PUBLIC_API_BASE"]);
  process.env.NEXT_PUBLIC_FORMS_MODE = "direct";
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "http://127.0.0.1:9";
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    throw new Error("fetch should not run");
  };
  try {
    await assert.rejects(
      () =>
        runCheck(
          { url: "https://example.ru", smartToken: "" },
          fetchImpl
        ),
      (err: unknown) => err instanceof PublicApiError && err.code === "captcha_required"
    );
    await assert.rejects(
      () =>
        runCheck(
          {
            url: "https://example.ru",
            email: "a@b.c",
            consentAccepted: false,
            smartToken: "token",
          },
          fetchImpl
        ),
      (err: unknown) => err instanceof PublicApiError && err.code === "consent_required"
    );
    await assert.rejects(
      () =>
        runLead(
          {
            name: "Анна",
            email: "a@b.c",
            consentAccepted: true,
            textVersion: "2026-10-11",
          },
          fetchImpl
        ),
      (err: unknown) => err instanceof PublicApiError && err.code === "captcha_required"
    );
    assert.equal(calls, 0);
    assert.equal("contacts" in buildPublicCheckBody({ url: "example.ru", smartToken: "t" }), false);
  } finally {
    restore();
  }
});

test("status mapping drops contacts even if the payload includes them", () => {
  const job = mapPublicCheck(
    {
      check_id: "abc",
      status: "done",
      url: "https://example.ru",
      findings: [{ rule_id: "C02", title: "Cookie", fact: "До согласия", severity: "high", email: "x@y.z" }],
      contacts: { email: "x@y.z" },
      screenshots: ["shot"],
      report_url: "javascript:alert(1)",
    },
    "https://example.ru",
    "abc"
  );
  assert.equal(job.reportUrl, null);
  assert.equal(JSON.stringify(job).includes("x@y.z"), false);
  assert.equal(job.pdfReady, true);
  assert.equal(job.phase, "done");
});

test("joinPublicApi refuses site /api paths", () => {
  const restore = saveEnv(["NEXT_PUBLIC_PUBLIC_API_BASE"]);
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "https://api.example.ru";
  try {
    assert.equal(joinPublicApi("/public/check"), "https://api.example.ru/public/check");
    assert.throws(() => joinPublicApi("/api/checks"), PublicApiError);
    assert.throws(() => joinPublicApi("/public/../api/leads"), PublicApiError);
  } finally {
    restore();
  }
});

test("direct mode BFF handlers reject before reading the body", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE"]);
  process.env.NEXT_PUBLIC_FORMS_MODE = "direct";
  const email = "direct-mode-must-not-store@example.com";
  const leadsPath = path.join(root, "data", "leads.json");
  const contactsPath = path.join(root, "data", "scan-contacts.json");
  const beforeLeads = fs.existsSync(leadsPath) ? fs.readFileSync(leadsPath, "utf8") : null;
  const beforeContacts = fs.existsSync(contactsPath) ? fs.readFileSync(contactsPath, "utf8") : null;
  try {
    const blocked = rejectDirectModeBff();
    assert.equal(blocked?.status, 410);
    const { POST: postLead } = await import("../app/api/leads/route.ts");
    const { POST: postCheck } = await import("../app/api/checks/route.ts");
    const { GET: getCheck } = await import("../app/api/checks/[id]/route.ts");
    const leadRes = await postLead(
      new Request("http://site.test/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Секрет",
          email,
          phone: "+70000000000",
          consent: true,
        }),
      })
    );
    const checkRes = await postCheck(
      new Request("http://site.test/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.ru", lead: { email, consent: true } }),
      })
    );
    const statusRes = await getCheck(new Request("http://site.test/api/checks/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    assert.equal(leadRes.status, 410);
    assert.equal(checkRes.status, 410);
    assert.equal(statusRes.status, 410);
    assert.equal((await leadRes.json()).error.includes(email), false);
    const afterLeads = fs.existsSync(leadsPath) ? fs.readFileSync(leadsPath, "utf8") : null;
    const afterContacts = fs.existsSync(contactsPath) ? fs.readFileSync(contactsPath, "utf8") : null;
    assert.equal(afterLeads, beforeLeads);
    assert.equal(afterContacts, beforeContacts);
    assert.equal((afterLeads || "").includes(email), false);
    assert.equal((afterContacts || "").includes(email), false);
  } finally {
    restore();
  }
});

test("BFF route handlers call the direct-mode guard before req.json()", () => {
  const files = [
    "app/api/leads/route.ts",
    "app/api/checks/route.ts",
    "app/api/checks/[id]/route.ts",
    "app/api/checks/[id]/pdf/route.ts",
  ];
  for (const file of files) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    const guardAt = src.indexOf("rejectDirectModeBff()");
    const readAt = src.indexOf("req.json()");
    assert.ok(guardAt > 0, file);
    if (readAt !== -1) assert.ok(guardAt < readAt, file);
  }
});

test("CSP allows only self, the API origin, and SmartCaptcha", () => {
  const header = contentSecurityPolicy({
    NODE_ENV: "production",
    NEXT_PUBLIC_PUBLIC_API_BASE: "https://api.example.ru/ignored",
  } as NodeJS.ProcessEnv);
  assert.match(header, /default-src 'self'/);
  assert.match(header, /https:\/\/api\.example\.ru/);
  for (const origin of SMARTCAPTCHA_ORIGINS) {
    assert.ok(header.includes(origin), origin);
  }
  assert.equal(header.includes("https://smartcaptcha.yandexcloud.net/captcha.js") || SMARTCAPTCHA_SCRIPT_SRC.startsWith("https://smartcaptcha.yandexcloud.net/"), true);
  assert.equal(header.includes("telegram"), false);
  assert.equal(header.includes("google"), false);
  assert.equal(header.includes("unsafe-eval"), false);
  assert.match(header, /script-src 'self' 'unsafe-inline'/);
  const dev = contentSecurityPolicy({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
  assert.match(dev, /unsafe-eval/);
});

test("BFF labels scans with origin site_form and the UI drops scan contacts", async () => {
  const withLead = landingScanCreateBody("https://example.ru", {
    name: "Иван",
    email: "ivan@example.com",
    phone: "+79990000000",
    consent: true,
    consent_text_version: "not-the-allowlist",
  });
  assert.equal((withLead.lead as { consent_text_version: string }).consent_text_version, "2026-10-11");
  assert.equal(withLead.origin, SITE_FORM_ORIGIN);
  assert.equal(withLead.mode, "quick");
  assert.equal((withLead.lead as { email: string }).email, "ivan@example.com");

  const bare = landingScanCreateBody("https://example.ru", null);
  assert.equal(bare.origin, SITE_FORM_ORIGIN);
  assert.equal("lead" in bare, false);

  const leaked = {
    id: "1",
    url: "https://example.ru/",
    domain: "example.ru",
    phase: "done",
    phaseMessage: "готово",
    score: 10,
    findings: [],
    hasRisks: false,
    createdAt: "t",
    updatedAt: "t",
    mock: false,
    contact: { phone: "", email: "info@example.ru", name: "Оператор" },
    phone: "",
    email: "info@example.ru",
    lead: { phone: "", email: "" },
  } as unknown as import("../lib/types").CheckJob;

  for (const view of [publicCheckJob(leaked), checkForDisplay(leaked)]) {
    const raw = JSON.stringify(view);
    assert.equal(raw.includes("info@example.ru"), false);
    assert.equal(raw.includes("Оператор"), false);
    assert.equal("contact" in view, false);
    assert.equal("phone" in view, false);
    assert.equal("email" in view, false);
    assert.equal(view.phase, "done");
    assert.equal(view.score, 10);
  }

  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE"]);
  delete process.env.NEXT_PUBLIC_FORMS_MODE;
  const fetchImpl: typeof fetch = async () => Response.json(leaked);
  try {
    const created = await runCheck({ url: "https://example.ru" }, fetchImpl);
    const polled = await pollCheck(created.id, created, fetchImpl);
    assert.equal(JSON.stringify(created).includes("info@example.ru"), false);
    assert.equal(JSON.stringify(polled).includes("info@example.ru"), false);
    assert.equal("contact" in created, false);
    assert.equal("contact" in polled, false);
    assert.equal(polled.findings.length, 0);
  } finally {
    restore();
  }

  const ui = fs.readFileSync(path.join(root, "components/check/UrlChecker.tsx"), "utf8");
  assert.equal(ui.includes("job.contact"), false);
  assert.equal(ui.includes("job.phone"), false);
  assert.equal(ui.includes("job.email"), false);
});

test("public check parses null and non-null inn and org_name without showing them", () => {
  const hidden = "[контактные данные скрыты]";
  const finding = {
    rule_id: "P01",
    title: `Политика ${hidden}`,
    fact: `Текст ${hidden}`,
    severity: "high",
    screenshot: "data:image/png;base64,AAAA",
    email: "hidden@example.com",
  };
  const cases = [
    { inn: null, org_name: null },
    { inn: "7707083893", org_name: "ООО Ромашка" },
  ];
  for (const org of cases) {
    const body = {
      check_id: "a".repeat(16),
      status: "done",
      url: "https://example.ru",
      score: 12,
      findings: [finding],
      inventory: null,
      unexpected_field: { email: "secret@example.com" },
      ...org,
    };
    const parsed = publicCheckResponseSchema.safeParse(body);
    assert.equal(parsed.success, true);
    if (!parsed.success) continue;
    assert.equal(parsed.data.inn, org.inn);
    assert.equal(parsed.data.org_name, org.org_name);
    assert.equal(publicCheckRecord(body).inn, undefined);
    assert.equal(publicCheckRecord(body).org_name, undefined);

    const job = mapPublicCheck(body, "https://example.ru", body.check_id);
    const serialized = JSON.stringify(job);
    assert.equal(serialized.includes("7707083893"), false);
    assert.equal(serialized.includes("ООО Ромашка"), false);
    assert.equal(serialized.includes("secret@example.com"), false);
    assert.equal(serialized.includes("hidden@example.com"), false);
    assert.equal("inn" in job, false);
    assert.equal("org_name" in job, false);
    assert.equal(job.findings[0].title, finding.title);
    assert.equal(job.findings[0].fact, finding.fact);

    const displayed = checkForDisplay({ ...job, inn: org.inn, org_name: org.org_name } as never);
    const shown = JSON.stringify(displayed);
    assert.equal("inn" in displayed, false);
    assert.equal("org_name" in displayed, false);
    assert.equal(shown.includes("7707083893"), false);
    assert.equal(shown.includes("ООО Ромашка"), false);
    assert.equal(shown.includes(hidden), true);
  }

  const nullOnly = publicCheckResponseSchema.safeParse({
    inn: null,
    org_name: null,
    findings: [{ rule_id: "P01", title: null, fact: hidden, extra: 1 }],
  });
  assert.equal(nullOnly.success, true);

  const ui = fs.readFileSync(path.join(root, "components/check/UrlChecker.tsx"), "utf8");
  assert.equal(ui.includes("dangerouslySetInnerHTML"), false);
  assert.equal(ui.includes("org_name"), false);
  assert.equal(ui.includes("job.inn"), false);
});

test("created check keeps only the report_url from 202", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_PUBLIC_API_BASE"]);
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "https://api.example.ru";
  const reportUrl = "https://api.example.ru/r/abc";
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/public/check")) {
      return Response.json(
        { check_id: "f".repeat(64), report_url: reportUrl, token: "do-not-keep", contacts: { email: "a@b.c" } },
        { status: 202 }
      );
    }
    return Response.json(
      { check_id: "f".repeat(64), status: "queued", findings: [] },
      { status: 200 }
    );
  };
  try {
    const created = await createPublicCheck(
      { url: "https://example.ru", smartToken: "t" },
      fetchImpl
    );
    assert.equal(created.reportUrl, reportUrl);
    assert.equal(JSON.stringify(created).includes("do-not-keep"), false);
    assert.equal(JSON.stringify(created).includes("a@b.c"), false);
    const polled = await getPublicCheck(created.id, created, fetchImpl);
    assert.equal(polled.reportUrl, created.reportUrl);
  } finally {
    restore();
  }
});

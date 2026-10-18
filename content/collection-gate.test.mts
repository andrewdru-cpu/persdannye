import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import CheckPage from "../app/check/page.tsx";
import RootLayout from "../app/layout.tsx";
import HomePage from "../app/page.tsx";
import { GET as getCheck } from "../app/api/checks/[id]/route.ts";
import { GET as getCheckPdf } from "../app/api/checks/[id]/pdf/route.ts";
import { POST as postCheck } from "../app/api/checks/route.ts";
import { POST as postLead } from "../app/api/leads/route.ts";
import { COLLECTION_CLOSED_NOTICE } from "../lib/collection-gate.ts";
import { flags } from "./flags.ts";

const PROBE_EMAIL = "probe-secret@example.test";
const PROBE_PHONE = "+79990001122";
const ANALYTICS = /mc\.yandex|metrika|gtag/i;
const CONTACT_INPUT =
  /type="(?:email|tel)"|autocomplete="(?:email|tel)"|inputmode="(?:email|tel)"|aria-label="[^"]*(?:e-mail|телефон|phone)/i;

const probeBody = {
  name: "Probe",
  email: PROBE_EMAIL,
  phone: PROBE_PHONE,
  url: "https://probe-secret.example",
  consent: true,
  consent_text_version: "2026-10-11-lead",
  message: "probe-secret-message",
};

function contactInputs(html: string): string[] {
  return [...html.matchAll(/<input\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => CONTACT_INPUT.test(tag));
}

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function trackParams(): { params: Promise<{ id: string }>; read: () => boolean } {
  let read = false;
  const params = Promise.resolve({ id: "scan-1" });
  const then = params.then.bind(params);
  params.then = ((onFulfilled, onRejected) => {
    read = true;
    return then(onFulfilled, onRejected);
  }) as typeof params.then;
  return { params, read: () => read };
}

async function html(page: "home" | "check"): Promise<string> {
  const child = page === "home" ? await HomePage() : CheckPage();
  return renderToStaticMarkup(await RootLayout({ children: child }));
}

describe("personal data collection gate", { concurrency: false }, () => {
  const saved = {
    parserBase: process.env.PARSER_API_BASE,
    parserUrl: process.env.PARSER_API_URL,
  };

  afterEach(() => {
    flags.collect_pd = false;
    if (saved.parserBase === undefined) delete process.env.PARSER_API_BASE;
    else process.env.PARSER_API_BASE = saved.parserBase;
    if (saved.parserUrl === undefined) delete process.env.PARSER_API_URL;
    else process.env.PARSER_API_URL = saved.parserUrl;
    mock.restoreAll();
  });

  it("keeps collect_pd off and leaves the other flags alone", () => {
    assert.equal(flags.collect_pd, false);
    assert.equal(flags.show_lead_form, true);
    assert.equal(flags.show_fines, false);
    assert.equal(flags.show_marketing_consent, false);
    assert.equal(flags.show_site_legal, false);
  });

  it("returns 503 for every lead and scan route and does not call fetch", async () => {
    process.env.PARSER_API_BASE = "https://parser.invalid";
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run while collection is off");
    });
    const logs: string[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      mock.method(console, method, (...args: unknown[]) => {
        logs.push(args.map((arg) => String(arg)).join(" "));
      });
    }

    const leadReq = post("/api/leads", probeBody);
    const checkReq = post("/api/checks", {
      url: "https://probe-secret.example",
      lead: { email: PROBE_EMAIL, phone: PROBE_PHONE, consent: true },
    });
    const statusParams = trackParams();
    const pdfParams = trackParams();

    const leadRes = await postLead(leadReq);
    const checkRes = await postCheck(checkReq);
    const statusRes = await getCheck(new Request("http://localhost/api/checks/scan-1"), {
      params: statusParams.params,
    });
    const pdfRes = await getCheckPdf(new Request("http://localhost/api/checks/scan-1/pdf"), {
      params: pdfParams.params,
    });

    for (const res of [leadRes, checkRes, statusRes, pdfRes]) {
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: "collection_disabled" });
    }
    assert.equal(leadReq.bodyUsed, false);
    assert.equal(checkReq.bodyUsed, false);
    assert.equal(statusParams.read(), false);
    assert.equal(pdfParams.read(), false);
    assert.equal(fetchMock.mock.calls.length, 0);
    const logged = logs.join("\n");
    assert.equal(logged.includes(PROBE_EMAIL), false);
    assert.equal(logged.includes(PROBE_PHONE), false);
  });

  it("renders / and /check without analytics scripts or contact fields", async () => {
    for (const page of ["home", "check"] as const) {
      const rendered = await html(page);
      assert.equal(ANALYTICS.test(rendered), false, page);
      assert.deepEqual(contactInputs(rendered), [], page);
      assert.equal(rendered.includes("<form"), false, page);
      assert.equal(rendered.includes('id="url-check-input"'), false, page);
      assert.equal(rendered.includes('href="/#lead"'), false, page);
      assert.equal(rendered.includes(COLLECTION_CLOSED_NOTICE), true, page);
      assert.equal(rendered.includes("Настройки cookie"), false, page);
    }
  });

  it("keeps the previous lead, scan, and form behaviour when collection is on", async () => {
    flags.collect_pd = true;
    delete process.env.PARSER_API_BASE;
    delete process.env.PARSER_API_URL;

    const leadRes = await postLead(
      post("/api/leads", { name: "Анна", email: PROBE_EMAIL, consent: false }),
    );
    assert.equal(leadRes.status, 400);
    const leadBody = (await leadRes.json()) as { error?: string };
    assert.equal(leadBody.error, "Нужно согласие на обработку персональных данных");

    const checkRes = await postCheck(post("/api/checks", { url: "example.com" }));
    assert.equal(checkRes.status, 201);
    const checkBody = (await checkRes.json()) as { error?: string; url?: string };
    assert.notEqual(checkBody.error, "collection_disabled");
    assert.equal(typeof checkBody.url, "string");

    const statusRes = await getCheck(new Request("http://localhost/api/checks/missing"), {
      params: Promise.resolve({ id: "missing-scan" }),
    });
    assert.equal(statusRes.status, 404);

    for (const page of ["home", "check"] as const) {
      const rendered = await html(page);
      assert.equal(rendered.includes(COLLECTION_CLOSED_NOTICE), false, page);
      assert.equal(contactInputs(rendered).length > 0, true, page);
      assert.equal(rendered.includes("<form"), true, page);
      assert.equal(ANALYTICS.test(rendered), false, page);
    }
    const home = await html("home");
    assert.equal(home.includes('href="/#lead"'), true);
  });
});

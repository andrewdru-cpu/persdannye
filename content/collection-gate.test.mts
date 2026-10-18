import assert from "node:assert/strict";
import { readFileSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it, mock } from "node:test";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CheckPage from "../app/check/page.tsx";
import RootLayout from "../app/layout.tsx";
import HomePage from "../app/page.tsx";
import { GET as getCheck } from "../app/api/checks/[id]/route.ts";
import { GET as getCheckPdf } from "../app/api/checks/[id]/pdf/route.ts";
import { POST as postCheck } from "../app/api/checks/route.ts";
import { POST as postLead } from "../app/api/leads/route.ts";
import { UrlChecker } from "../components/check/UrlChecker.tsx";
import { COLLECTION_CLOSED_NOTICE } from "../components/collection/CollectionClosed.tsx";
import { collectionEnabled } from "../lib/collection-gate.ts";
import { flags } from "./flags.ts";

const PROBE_EMAIL = "probe-secret@example.test";
const PROBE_PHONE = "+79990001122";
const CONSENT_SENTINEL = "consent-version-qa-8741-do-not-store";
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

const clientSources = [
  "../components/landing/Sections.tsx",
  "../components/check/UrlChecker.tsx",
  "../components/layout/AnalyticsGate.tsx",
  "../components/layout/CookieBanner.tsx",
  "../components/layout/StickyCta.tsx",
  "../components/landing/LeadForm.tsx",
  "../components/collection/CollectionClosed.tsx",
];

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

function componentNames(node: ReactNode, found: Set<string>): void {
  if (node == null || typeof node === "boolean") return;
  if (Array.isArray(node)) {
    for (const child of node) componentNames(child, found);
    return;
  }
  if (!isValidElement(node)) return;
  const type = node.type;
  if (typeof type === "function") found.add(type.name || "");
  const children = (node.props as { children?: ReactNode }).children;
  componentNames(children, found);
}

function postEnv(value: string | undefined) {
  if (value === undefined) delete process.env.PD_COLLECTION_ENABLED;
  else process.env.PD_COLLECTION_ENABLED = value;
}

async function html(page: "home" | "check"): Promise<string> {
  const child = page === "home" ? await HomePage() : CheckPage();
  return renderToStaticMarkup(await RootLayout({ children: child }));
}

async function treeNames(): Promise<Set<string>> {
  const found = new Set<string>();
  componentNames(await RootLayout({ children: await HomePage() }), found);
  return found;
}

describe("personal data collection gate", { concurrency: false }, () => {
  const saved = {
    parserBase: process.env.PARSER_API_BASE,
    parserUrl: process.env.PARSER_API_URL,
    collection: process.env.PD_COLLECTION_ENABLED,
    siteLegal: flags.show_site_legal,
    cookiePolicy: flags.show_cookie_policy,
  };

  afterEach(() => {
    flags.show_site_legal = saved.siteLegal;
    flags.show_cookie_policy = saved.cookiePolicy;
    postEnv(saved.collection);
    if (saved.parserBase === undefined) delete process.env.PARSER_API_BASE;
    else process.env.PARSER_API_BASE = saved.parserBase;
    if (saved.parserUrl === undefined) delete process.env.PARSER_API_URL;
    else process.env.PARSER_API_URL = saved.parserUrl;
    mock.restoreAll();
  });

  it("does not keep a collect_pd flag and does not read the env on the client", () => {
    assert.equal("collect_pd" in flags, false);
    assert.equal(flags.show_lead_form, true);
    assert.equal(flags.show_site_legal, false);
    for (const file of clientSources) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.equal(source.includes("PD_COLLECTION_ENABLED"), false, file);
      assert.equal(source.includes("collection-gate"), false, file);
    }
  });

  it("stays off when PD_COLLECTION_ENABLED is unset", () => {
    postEnv(undefined);
    flags.show_site_legal = true;
    assert.equal(collectionEnabled(), false);
    flags.show_site_legal = false;
    assert.equal(collectionEnabled(), false);
  });

  it("stays off when PD_COLLECTION_ENABLED is any value other than true", () => {
    flags.show_site_legal = true;
    for (const value of ["", "false", "TRUE", "True", "1", "yes", " true", "true "]) {
      postEnv(value);
      assert.equal(collectionEnabled(), false, JSON.stringify(value));
    }
  });

  it("turns on only when PD_COLLECTION_ENABLED is true and the policy is published", () => {
    postEnv("true");
    flags.show_site_legal = false;
    assert.equal(collectionEnabled(), false);
    flags.show_site_legal = true;
    assert.equal(collectionEnabled(), true);
  });

  it("keeps the lead form, report email, Metrika, and optional cookies off while the policy is unpublished", async () => {
    flags.show_site_legal = false;
    flags.show_cookie_policy = false;
    for (const value of [undefined, "", "false", "TRUE", "1", "yes", "true"]) {
      postEnv(value);
      assert.equal(collectionEnabled(), false, String(value));
      process.env.PARSER_API_BASE = "https://parser.invalid";
      const fetchMock = mock.method(globalThis, "fetch", async () => {
        throw new Error("fetch should not run");
      });
      const leadReq = post("/api/leads", probeBody);
      const leadRes = await postLead(leadReq);
      assert.equal(leadRes.status, 503, String(value));
      assert.deepEqual(await leadRes.json(), { error: "collection_disabled" });
      assert.equal(leadReq.bodyUsed, false);

      const checkReq = post("/api/checks", {
        url: "https://probe-secret.example",
        lead: {
          email: PROBE_EMAIL,
          consent: true,
          consent_text_version: CONSENT_SENTINEL,
        },
      });
      const checkRes = await postCheck(checkReq);
      assert.equal(checkRes.status, 503, String(value));
      assert.equal(checkReq.bodyUsed, false);
      assert.equal((await checkRes.clone().text()).includes(CONSENT_SENTINEL), false);

      const statusReq = new Request("http://localhost/api/checks/probe-secret");
      const statusRes = await getCheck(statusReq, { params: Promise.resolve({ id: "probe-secret" }) });
      assert.equal(statusRes.status, 503, String(value));

      const pdfReq = new Request("http://localhost/api/checks/probe-secret/pdf");
      const pdfRes = await getCheckPdf(pdfReq, { params: Promise.resolve({ id: "probe-secret" }) });
      assert.equal(pdfRes.status, 503, String(value));
      assert.equal(fetchMock.mock.calls.length, 0, String(value));
      fetchMock.mock.restore();

      for (const page of ["home", "check"] as const) {
        const rendered = await html(page);
        assert.equal(rendered.includes("<form"), false, `${page} ${value}`);
        assert.equal(rendered.includes('id="lead"') && rendered.includes('aria-label="Имя"'), false, page);
        assert.equal(rendered.includes("E-mail для отчёта"), false, page);
        assert.deepEqual(contactInputs(rendered), [], page);
        assert.equal(ANALYTICS.test(rendered), false, page);
        assert.equal(rendered.includes("Настройки cookie"), false, page);
        assert.equal(rendered.includes("маркетинговые cookie"), false, page);
        assert.equal(rendered.includes(">Принять<"), false, page);
        assert.equal(rendered.includes(">Отклонить<"), false, page);
        assert.equal(rendered.includes(">Настроить<"), false, page);
        assert.equal(rendered.includes("Политике cookie"), false, page);
        assert.equal(rendered.includes('href="/cookies"'), false, page);
        assert.equal(rendered.includes("/cookies"), false, page);
        assert.equal(rendered.includes(COLLECTION_CLOSED_NOTICE), true, page);
      }
      const names = await treeNames();
      assert.equal(names.has("CookieBanner"), false, String(value));
      assert.equal(names.has("AnalyticsGate"), false, String(value));
      assert.equal(names.has("UrlChecker"), false, String(value));
      assert.equal(names.has("LeadForm"), false, String(value));

      const checker = renderToStaticMarkup(createElement(UrlChecker, { collectionEnabled: false }));
      assert.equal(checker.includes("E-mail для отчёта"), false);
      assert.equal(checker.includes("<form"), false);
      assert.equal(checker.includes(COLLECTION_CLOSED_NOTICE), true);
    }
  });

  it("returns 503 for a lead and a scan lead and does not store consent_text_version", async () => {
    flags.show_site_legal = false;
    for (const value of [undefined, "true", "false"]) {
      postEnv(value);
      assert.equal(collectionEnabled(), false, String(value));
      process.env.PARSER_API_BASE = "https://parser.invalid";
      const fetchMock = mock.method(globalThis, "fetch", async () => {
        throw new Error("fetch should not run");
      });
      const writeMock = mock.method(fs, "writeFile", async () => undefined);
      const appendMock = mock.method(fs, "appendFile", async () => undefined);
      const logs: unknown[] = [];
      const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;
      const restoreConsole = consoleMethods.map((method) => {
        const original = console[method].bind(console);
        console[method] = (...args: unknown[]) => {
          logs.push(args);
        };
        return () => {
          console[method] = original;
        };
      });

      try {
        const leadReq = post("/api/leads", { ...probeBody, consent_text_version: CONSENT_SENTINEL });
        const leadRes = await postLead(leadReq);
        assert.equal(leadRes.status, 503, String(value));
        assert.equal(leadReq.bodyUsed, false);
        assert.equal((await leadRes.text()).includes(CONSENT_SENTINEL), false);

        const checkReq = post("/api/checks", {
          url: "https://probe-secret.example",
          lead: {
            name: "Probe",
            email: PROBE_EMAIL,
            phone: PROBE_PHONE,
            consent: true,
            consent_text_version: CONSENT_SENTINEL,
            marketing_consent: true,
            marketing_consent_text_version: CONSENT_SENTINEL,
          },
        });
        const checkRes = await postCheck(checkReq);
        assert.equal(checkRes.status, 503, String(value));
        assert.equal(checkReq.bodyUsed, false);
        assert.equal((await checkRes.text()).includes(CONSENT_SENTINEL), false);

        assert.equal(fetchMock.mock.calls.length, 0, String(value));
        const stored = JSON.stringify([
          writeMock.mock.calls,
          appendMock.mock.calls,
          logs,
        ]);
        assert.equal(stored.includes(CONSENT_SENTINEL), false, String(value));
        assert.equal(stored.includes(PROBE_EMAIL), false, String(value));
        assert.equal(writeMock.mock.calls.length, 0, String(value));
        assert.equal(appendMock.mock.calls.length, 0, String(value));
        for (const file of ["leads.json", "scan-contacts.json"]) {
          const candidates = [
            path.join(process.cwd(), "data", file),
            path.join(os.tmpdir(), "persdannye-data", file),
          ];
          for (const candidate of candidates) {
            let raw = "";
            try {
              raw = await fs.readFile(candidate, "utf8");
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
            }
            assert.equal(raw.includes(CONSENT_SENTINEL), false, candidate);
            assert.equal(raw.includes(PROBE_EMAIL), false, candidate);
          }
        }
      } finally {
        for (const restore of restoreConsole) restore();
        fetchMock.mock.restore();
        writeMock.mock.restore();
        appendMock.mock.restore();
      }
    }
  });

  it("shows the cookies link in the footer and FAQ only when the cookie policy flag is on", async () => {
    flags.show_cookie_policy = false;
    const hidden = await html("home");
    assert.equal(hidden.includes('href="/cookies"'), false);
    assert.equal(hidden.includes("/cookies"), false);

    flags.show_cookie_policy = true;
    const shown = await html("home");
    assert.equal(shown.includes('href="/cookies"'), true);
    assert.equal(shown.includes("https://persdannye.ru/cookies"), true);
  });

  it("keeps the previous lead, scan, and form behaviour when collection is on", async () => {
    postEnv("true");
    flags.show_site_legal = true;
    assert.equal(collectionEnabled(), true);
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

    const names = await treeNames();
    assert.equal(names.has("CookieBanner"), true);
    assert.equal(names.has("AnalyticsGate"), true);

    for (const page of ["home", "check"] as const) {
      const rendered = await html(page);
      assert.equal(rendered.includes(COLLECTION_CLOSED_NOTICE), false, page);
      assert.equal(rendered.includes("E-mail для отчёта"), true, page);
      assert.equal(contactInputs(rendered).length > 0, true, page);
      assert.equal(rendered.includes("<form"), true, page);
      assert.equal(ANALYTICS.test(rendered), false, page);
    }
    const home = await html("home");
    assert.equal(home.includes('href="/#lead"'), true);
    assert.equal(home.includes('id="lead"'), true);
  });
});

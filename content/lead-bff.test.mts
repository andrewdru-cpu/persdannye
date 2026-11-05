import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { POST as postLead } from "../app/api/lead/route.ts";
import { GET as getGone, POST as postGone } from "../app/api/checks/[[...slug]]/route.ts";
import { GET as getHealth } from "../app/api/health/route.ts";
import { GET as getScan } from "../app/api/scan/[id]/route.ts";
import { GET as getScanPdf } from "../app/api/scan/[id]/pdf/route.ts";
import { flags } from "./flags.ts";

const SCAN_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "anna@example.com";
const TOKEN = "test-parser-token";

function enableCollection() {
  process.env.PD_COLLECTION_ENABLED = "true";
  flags.show_site_legal = true;
}

function validBody(extra: Record<string, unknown> = {}) {
  return {
    name: "Анна",
    email: EMAIL,
    phone: "+79990001122",
    url: "https://example.com/path",
    consent: true,
    consent_version: "evil-client-version",
    consent_at: "1999-01-01T00:00:00.000Z",
    marketing_consent: false,
    source: "landing",
    fax: "",
    ...extra,
  };
}

function leadRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("lead BFF", { concurrency: false }, () => {
  const saved = {
    base: process.env.PARSER_API_BASE,
    token: process.env.PARSER_API_TOKEN,
    collection: process.env.PD_COLLECTION_ENABLED,
    siteLegal: flags.show_site_legal,
  };

  afterEach(() => {
    flags.show_site_legal = saved.siteLegal;
    if (saved.collection === undefined) delete process.env.PD_COLLECTION_ENABLED;
    else process.env.PD_COLLECTION_ENABLED = saved.collection;
    if (saved.base === undefined) delete process.env.PARSER_API_BASE;
    else process.env.PARSER_API_BASE = saved.base;
    if (saved.token === undefined) delete process.env.PARSER_API_TOKEN;
    else process.env.PARSER_API_TOKEN = saved.token;
    mock.restoreAll();
  });

  it("answers /api/lead with 410 and does not read personal data", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const req = leadRequest(validBody(), {
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.9",
    });
    const res = await postLead(req);
    assert.equal(res.status, 410);
    assert.equal(req.bodyUsed, false);
    assert.equal(fetchMock.mock.calls.length, 0);
    const body = await res.text();
    assert.equal(body.includes(EMAIL), false);
    assert.equal(body.includes("198.51.100.9"), false);
    assert.equal(body.includes(TOKEN), false);
    assert.deepEqual(JSON.parse(body), { error: "gone" });
  });

  it("strips contact fields from the scan status and forwards X-PD-Client-IP", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    let clientIp: string | null = null;
    mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      clientIp = new Headers(init?.headers).get("x-pd-client-ip");
      return new Response(
        JSON.stringify({
          phase: "done",
          url: "https://example.com",
          score: 3,
          lead: { email: EMAIL, name: "Анна" },
          email: EMAIL,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const ok = await getScan(
      new Request("http://localhost/api/scan/" + SCAN_ID, { headers: { "x-real-ip": "203.0.113.10" } }),
      { params: Promise.resolve({ id: SCAN_ID }) },
    );
    assert.equal(ok.status, 200);
    assert.equal(clientIp, "203.0.113.10");
    const body = await ok.text();
    assert.equal(body.includes(EMAIL), false);
    assert.equal(body.includes("Анна"), false);
  });

  it("does not fetch a PDF without X-Real-IP", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await getScanPdf(new Request(`http://localhost/api/scan/${SCAN_ID}/pdf`), {
      params: Promise.resolve({ id: SCAN_ID }),
    });
    assert.equal(res.status, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("does not fetch scan status without X-Real-IP", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await getScan(new Request("http://localhost/api/scan/" + SCAN_ID), {
      params: Promise.resolve({ id: SCAN_ID }),
    });
    assert.equal(res.status, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("forwards 429 from the scan status proxy", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    let clientIp: string | null = null;
    mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      clientIp = new Headers(init?.headers).get("x-pd-client-ip");
      return new Response("secret", { status: 429 });
    });
    const limited = await getScan(
      new Request("http://localhost/api/scan/" + SCAN_ID, { headers: { "x-real-ip": "2001:db8::10" } }),
      { params: Promise.resolve({ id: SCAN_ID }) },
    );
    assert.equal(limited.status, 429);
    assert.equal(clientIp, "2001:db8::10");
    assert.equal((await limited.text()).includes("secret"), false);
  });

  it("forwards X-PD-Client-IP on the PDF proxy", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    let clientIp: string | null = null;
    let path = "";
    mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
      path = String(input);
      clientIp = new Headers(init?.headers).get("x-pd-client-ip");
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    });
    const res = await getScanPdf(
      new Request("http://localhost/api/scan/" + SCAN_ID + "/pdf", { headers: { "x-real-ip": "203.0.113.44" } }),
      { params: Promise.resolve({ id: SCAN_ID }) },
    );
    assert.equal(res.status, 200);
    assert.equal(clientIp, "203.0.113.44");
    assert.match(path, /\/pdf$/);
  });

  it("answers the health check without the parser", async () => {
    delete process.env.PD_COLLECTION_ENABLED;
    flags.show_site_legal = false;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await getHealth();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("does not keep telegram, disk storage, or error dumps in the lead path", () => {
    const route = readFileSync(new URL("../app/api/lead/route.ts", import.meta.url), "utf8");
    const bff = readFileSync(new URL("../lib/lead-bff.ts", import.meta.url), "utf8");
    const direct = readFileSync(new URL("../lib/ru-api.ts", import.meta.url), "utf8");
    const form = readFileSync(new URL("../components/landing/LeadForm.tsx", import.meta.url), "utf8");
    const checker = readFileSync(new URL("../components/check/UrlChecker.tsx", import.meta.url), "utf8");
    for (const source of [route, bff, direct, form, checker]) {
      assert.equal(source.includes("telegram"), false, source.slice(0, 40));
      assert.equal(source.includes("TELEGRAM_"), false);
      assert.equal(source.includes("console.error"), false);
      assert.equal(source.includes("writeFile"), false);
      assert.equal(source.includes("api.telegram.org"), false);
    }
    assert.equal(form.includes("/api/lead"), false);
    assert.equal(checker.includes("/api/lead"), false);
    assert.equal(checker.includes("/api/scan/"), false);
    assert.match(form, /postRuLead/);
    assert.match(checker, /postRuCheck/);
    assert.match(checker, /getRuCheck/);
    assert.match(direct, /https:\/\/api\.scanweb\.pro/);
    assert.equal(form.includes("consent_at"), false);
    assert.equal(direct.includes("consent_at"), false);
    assert.match(form, /HoneypotField/);
    assert.equal(form.includes("FormOpenedField"), false);
    assert.equal(form.includes("form-ticket"), false);
    assert.match(checker, /HoneypotField/);
    assert.equal(checker.includes("FormOpenedField"), false);
    assert.equal(checker.includes("form-ticket"), false);
    assert.equal(existsSync(new URL("../app/api/form-ticket/route.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/form-ticket.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/form-open.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../components/forms/FormOpenedField.tsx", import.meta.url)), false);
    assert.equal(existsSync(new URL("../instrumentation.ts", import.meta.url)), false);
    assert.equal(bff.includes("submitLead"), false);
    assert.equal(existsSync(new URL("../lib/parser-client.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/parser-auth.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/mock-parser.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/telegram.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/notify.ts", import.meta.url)), false);
    const docker = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    assert.equal(docker.includes("ln -s"), false);
    assert.equal(docker.includes("/tmp/next-cache"), false);
    assert.match(docker, /mkdir -p \.next\/cache/);
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    const release = readFileSync(new URL("../.github/workflows/release-image.yml", import.meta.url), "utf8");
    const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    assert.match(ci, /docker build --pull/);
    assert.match(release, /tags:\n\s+- "v\*"/);
    assert.match(release, /GITHUB_STEP_SUMMARY/);
    assert.match(release, /steps\.build\.outputs\.digest/);
    assert.match(release, /ghcr\.io\/andrewdru-cpu\/persdannye/);
    assert.equal(release.split("\njobs:")[0]?.includes("packages: write"), false);
    assert.match(release, /publish:[\s\S]*packages: write/);
    assert.match(config, /poweredByHeader:\s*false/);
    assert.equal(form.includes("Сообщение"), false);
    assert.equal(form.includes("message:"), false);
  });

  it("answers every /api/checks path with 410 and does not read the body", async () => {
    const body = JSON.stringify({ email: EMAIL, consent_version: "do-not-store" });
    const postReq = new Request("http://localhost/api/checks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const postRes = await postGone(postReq);
    assert.equal(postRes.status, 410);
    assert.equal(postReq.bodyUsed, false);
    assert.equal((await postRes.text()).includes(EMAIL), false);
    const nested = await getGone(new Request("http://localhost/api/checks/abc/pdf"));
    assert.equal(nested.status, 410);
    assert.deepEqual(await nested.json(), { error: "gone" });
  });
});

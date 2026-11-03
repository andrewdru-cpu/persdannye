import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { POST as postLead } from "../app/api/lead/route.ts";
import { GET as getTicket } from "../app/api/form-ticket/route.ts";
import { GET as getGone, POST as postGone } from "../app/api/checks/[[...slug]]/route.ts";
import { GET as getHealth } from "../app/api/health/route.ts";
import { GET as getScan } from "../app/api/scan/[id]/route.ts";
import { LEAD_CONSENT_TEXT_VERSION } from "../lib/consent.ts";
import { signFormOpened } from "../lib/form-ticket.ts";
import { LEAD_PARSER_FIELDS } from "../lib/lead-bff.ts";
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
    message: "Нужен разбор",
    consent: true,
    consent_version: "evil-client-version",
    consent_at: "1999-01-01T00:00:00.000Z",
    marketing_consent: false,
    source: "landing",
    fax: "",
    opened: signFormOpened(Date.now() - 10_000, TOKEN),
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

  it("returns 400 when X-Real-IP is missing and does not use X-Forwarded-For", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await postLead(
      leadRequest(validBody(), { "x-forwarded-for": "198.51.100.9" }),
    );
    assert.equal(res.status, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
    const text = await res.text();
    assert.equal(text.includes(EMAIL), false);
    assert.equal(text.includes("198.51.100.9"), false);
    assert.equal(text.includes(TOKEN), false);
  });

  it("rejects a comma-separated X-Real-IP instead of trusting the first address", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await postLead(
      leadRequest(validBody(), { "x-real-ip": "203.0.113.10, 198.51.100.9" }),
    );
    assert.equal(res.status, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("sends the bearer token and X-PD-Client-IP from X-Real-IP and returns 200", async () => {
    enableCollection();
    delete process.env.PARSER_API_BASE;
    process.env.PARSER_API_TOKEN = TOKEN;
    let seen: { url: string; headers: Headers; body: string } | null = null;
    mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
      seen = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      };
      return new Response(JSON.stringify({ scan_id: SCAN_ID }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const res = await postLead(
      leadRequest(validBody(), {
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.9",
      }),
    );
    assert.equal(res.status, 200);
    assert.ok(seen);
    const forwarded = seen as { url: string; headers: Headers; body: string };
    assert.equal(forwarded.url, "http://api:8080/api/scans");
    assert.equal(forwarded.headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(forwarded.headers.get("x-pd-client-ip"), "203.0.113.10");
    assert.equal(forwarded.headers.get("x-forwarded-for"), null);
    const sent = JSON.parse(forwarded.body) as {
      url: string;
      mode?: string;
      scan_id?: string;
      fax?: string;
      lead: Record<string, unknown>;
    };
    assert.equal(sent.url, "https://example.com/path");
    assert.equal(sent.mode, "quick");
    assert.equal(sent.scan_id, undefined);
    assert.equal(sent.fax, undefined);
    assert.equal(sent.lead.email, EMAIL);
    assert.equal("consent" in sent.lead, false);
    assert.equal(sent.lead.consent_version, LEAD_CONSENT_TEXT_VERSION);
    assert.notEqual(sent.lead.consent_at, "1999-01-01T00:00:00.000Z");
    assert.match(String(sent.lead.consent_at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.equal("scan_id" in sent.lead, false);
    assert.equal("message" in sent.lead, false);
    assert.equal("source" in sent.lead, false);
    assert.equal(sent.lead.marketing_consent, false);
    assert.equal("marketing_consent_at" in sent.lead, false);
    assert.equal("fax" in sent.lead, false);
    for (const key of Object.keys(sent.lead)) {
      assert.equal((LEAD_PARSER_FIELDS as readonly string[]).includes(key), true, key);
    }
    const client = (await res.json()) as { ok?: boolean; id?: string; email?: string };
    assert.equal(client.ok, true);
    assert.equal(client.id, SCAN_ID);
    assert.equal(client.email, undefined);
  });

  it("forwards parser 429 without the upstream body", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    const logs: unknown[] = [];
    const methods = ["log", "info", "warn", "error", "debug"] as const;
    const restore = methods.map((method) => {
      const original = console[method].bind(console);
      console[method] = (...args: unknown[]) => {
        logs.push(args);
      };
      return () => {
        console[method] = original;
      };
    });
    mock.method(globalThis, "fetch", async () => {
      return new Response(JSON.stringify({ error: EMAIL, detail: "rate-limit-secret" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "3" },
      });
    });
    try {
      const res = await postLead(leadRequest(validBody(), { "x-real-ip": "203.0.113.10" }));
      assert.equal(res.status, 429);
      assert.equal(res.headers.get("retry-after"), "3");
      const text = await res.text();
      assert.equal(text.includes(EMAIL), false);
      assert.equal(text.includes("rate-limit-secret"), false);
      assert.equal(text.includes(TOKEN), false);
      const logged = JSON.stringify(logs);
      assert.equal(logged.includes(EMAIL), false);
      assert.equal(logged.includes(TOKEN), false);
      assert.equal(logged.includes("203.0.113.10"), false);
    } finally {
      for (const undo of restore) undo();
    }
  });

  it("returns upstream 5xx status without parser details", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    mock.method(globalThis, "fetch", async () => {
      return new Response(`stack ${EMAIL}`, { status: 500, headers: { "content-type": "text/plain" } });
    });
    const res = await postLead(leadRequest(validBody(), { "x-real-ip": "2001:db8::10" }));
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.equal(text.includes(EMAIL), false);
    assert.equal(text.includes("stack"), false);
  });

  it("returns 200 for a filled honeypot and does not call the parser", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await postLead(leadRequest(validBody({ fax: "http://spam.example" })));
    assert.equal(res.status, 200);
    assert.equal(fetchMock.mock.calls.length, 0);
    const text = await res.text();
    assert.equal(text.includes("spam.example"), false);
    assert.equal(text.includes(EMAIL), false);
  });

  it("rejects a body larger than 16 KiB", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await postLead(leadRequest("x".repeat(16 * 1024 + 1), { "x-real-ip": "203.0.113.10" }));
    assert.equal(res.status, 413);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("strips contact fields from the scan status", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    mock.method(globalThis, "fetch", async () => {
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
    const ok = await getScan(new Request("http://localhost/api/scan/" + SCAN_ID), {
      params: Promise.resolve({ id: SCAN_ID }),
    });
    assert.equal(ok.status, 200);
    const body = await ok.text();
    assert.equal(body.includes(EMAIL), false);
    assert.equal(body.includes("Анна"), false);
  });

  it("forwards 429 from the scan status proxy", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    mock.method(globalThis, "fetch", async () => {
      return new Response("secret", { status: 429 });
    });
    const limited = await getScan(new Request("http://localhost/api/scan/" + SCAN_ID), {
      params: Promise.resolve({ id: SCAN_ID }),
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.text()).includes("secret"), false);
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
    const form = readFileSync(new URL("../components/landing/LeadForm.tsx", import.meta.url), "utf8");
    const checker = readFileSync(new URL("../components/check/UrlChecker.tsx", import.meta.url), "utf8");
    for (const source of [route, bff, form, checker]) {
      assert.equal(source.includes("telegram"), false);
      assert.equal(source.includes("console.error"), false);
      assert.equal(source.includes("writeFile"), false);
      assert.equal(source.includes("api.telegram.org"), false);
    }
    assert.match(form, /\/api\/lead/);
    assert.match(checker, /\/api\/lead/);
    assert.match(checker, /\/api\/scan\//);
    assert.match(form, /consent_version/);
    assert.equal(form.includes("consent_at"), false);
    assert.match(bff, /consent_at: now.toISOString\(\)/);
    assert.match(form, /HoneypotField/);
    assert.match(form, /FormOpenedField/);
    assert.match(checker, /HoneypotField/);
    assert.match(checker, /FormOpenedField/);
    assert.equal(existsSync(new URL("../lib/parser-client.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/parser-auth.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../lib/mock-parser.ts", import.meta.url)), false);
    const docker = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    assert.equal(docker.includes("ln -s"), false);
    assert.equal(docker.includes("/tmp/next-cache"), false);
    assert.match(docker, /mkdir -p \.next\/cache/);
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    const release = readFileSync(new URL("../.github/workflows/release-image.yml", import.meta.url), "utf8");
    assert.match(ci, /docker build --pull/);
    assert.match(release, /tags:\n\s+- "v\*"/);
    assert.match(release, /GITHUB_STEP_SUMMARY/);
    assert.match(release, /steps\.build\.outputs\.digest/);
    assert.match(release, /ghcr\.io/);
  });

  it("returns ok and skips the parser when the form was opened less than 3 seconds ago", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const res = await postLead(
      leadRequest(
        validBody({ opened: signFormOpened(Date.now() - 500, TOKEN) }),
        { "x-real-ip": "203.0.113.10" },
      ),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("treats a freshly issued ticket as too fast", async () => {
    enableCollection();
    process.env.PARSER_API_TOKEN = TOKEN;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("fetch should not run");
    });
    const ticketRes = await getTicket();
    assert.equal(ticketRes.status, 200);
    const ticket = ((await ticketRes.json()) as { ticket?: string }).ticket;
    assert.equal(typeof ticket, "string");
    const res = await postLead(
      leadRequest(validBody({ opened: ticket }), { "x-real-ip": "203.0.113.10" }),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("passes checkId as top-level scan_id and ignores client consent time", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    let body = "";
    mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: SCAN_ID }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const res = await postLead(
      leadRequest(
        validBody({ checkId: SCAN_ID, message: "секретное сообщение", source: "check-result" }),
        { "x-real-ip": "203.0.113.10" },
      ),
    );
    assert.equal(res.status, 200);
    const sent = JSON.parse(body) as { url: string; mode?: string; scan_id?: string; lead: Record<string, unknown> };
    assert.equal(sent.scan_id, SCAN_ID);
    assert.equal(sent.mode, "quick");
    assert.equal("scan_id" in sent.lead, false);
    assert.equal(sent.lead.message, undefined);
    assert.equal(sent.lead.source, undefined);
    assert.equal(sent.lead.consent_version, LEAD_CONSENT_TEXT_VERSION);
    assert.notEqual(sent.lead.consent_at, "1999-01-01T00:00:00.000Z");
    assert.equal(body.includes("секретное сообщение"), false);
    assert.equal(body.includes("evil-client-version"), false);
  });

  it("forwards parser 422 without the upstream body", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    mock.method(globalThis, "fetch", async () => {
      return new Response(JSON.stringify({ error: EMAIL, field: "lead.message" }), { status: 422 });
    });
    const res = await postLead(leadRequest(validBody(), { "x-real-ip": "203.0.113.10" }));
    assert.equal(res.status, 422);
    const text = await res.text();
    assert.equal(text.includes(EMAIL), false);
    assert.equal(text.includes("lead.message"), false);
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

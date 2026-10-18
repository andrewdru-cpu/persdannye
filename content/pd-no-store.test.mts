import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { afterEach, describe, it, mock } from "node:test";
import { GET as getCheck } from "../app/api/checks/[id]/route.ts";
import { GET as getCheckPdf } from "../app/api/checks/[id]/pdf/route.ts";
import { POST as postCheck } from "../app/api/checks/route.ts";
import { POST as postLead } from "../app/api/leads/route.ts";
import { LEAD_CONSENT_TEXT_VERSION } from "../lib/consent.ts";
import { flags } from "./flags.ts";
import { notifyNewLead, notifyScanIfNeeded } from "../lib/notify.ts";
import type { CheckJob, Lead } from "../lib/types.ts";

const NAME = "PdNameMarkerQ7";
const EMAIL = "pd-mail-marker-q7@example.test";
const PHONE = "79031110007";
const COMPANY = "PdCompanyMarkerQ7";
const COMMENT = "PdCommentMarkerQ7";
const CONSENT = "pd-consent-marker-q7";
const DOMAIN = "probe-q7.example";
const MARKERS = [NAME, EMAIL, PHONE, COMPANY, COMMENT];

type FetchCall = { url: string; body: string };

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function telegramText(calls: FetchCall[]): string {
  return calls
    .filter((call) => call.url.includes("sendMessage"))
    .map((call) => {
      try {
        const parsed = JSON.parse(call.body) as { text?: string };
        return parsed.text || "";
      } catch {
        return call.body;
      }
    })
    .join("\n");
}

function spyConsole(): { text: () => string; restore: () => void } {
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
  return {
    text: () => JSON.stringify(logs),
    restore: () => {
      for (const undo of restore) undo();
    },
  };
}

describe("personal data is not stored on Vercel or sent to Telegram", { concurrency: false }, () => {
  const saved = {
    collection: process.env.PD_COLLECTION_ENABLED,
    siteLegal: flags.show_site_legal,
    parserBase: process.env.PARSER_API_BASE,
    parserUrl: process.env.PARSER_API_URL,
    parserToken: process.env.PARSER_API_TOKEN,
    parserEmail: process.env.PARSER_API_EMAIL,
    parserPassword: process.env.PARSER_API_PASSWORD,
    bot: process.env.TELEGRAM_BOT_TOKEN,
    chat: process.env.TELEGRAM_CHAT_ID,
    site: process.env.NEXT_PUBLIC_SITE_URL,
  };

  afterEach(() => {
    flags.show_site_legal = saved.siteLegal;
    const restoreEnv = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restoreEnv("PD_COLLECTION_ENABLED", saved.collection);
    restoreEnv("PARSER_API_BASE", saved.parserBase);
    restoreEnv("PARSER_API_URL", saved.parserUrl);
    restoreEnv("PARSER_API_TOKEN", saved.parserToken);
    restoreEnv("PARSER_API_EMAIL", saved.parserEmail);
    restoreEnv("PARSER_API_PASSWORD", saved.parserPassword);
    restoreEnv("TELEGRAM_BOT_TOKEN", saved.bot);
    restoreEnv("TELEGRAM_CHAT_ID", saved.chat);
    restoreEnv("NEXT_PUBLIC_SITE_URL", saved.site);
    mock.restoreAll();
  });

  function enableCollection() {
    process.env.PD_COLLECTION_ENABLED = "true";
    flags.show_site_legal = true;
  }

  function enableTelegram() {
    process.env.TELEGRAM_BOT_TOKEN = "123456:pd-test-token";
    process.env.TELEGRAM_CHAT_ID = "424242";
    process.env.NEXT_PUBLIC_SITE_URL = "https://persdannye.ru";
  }

  function clearParser() {
    delete process.env.PARSER_API_BASE;
    delete process.env.PARSER_API_URL;
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;
  }

  it("accepts a lead with consent_text_version and keeps personal data out of files, logs, and Telegram", async () => {
    enableCollection();
    enableTelegram();
    clearParser();

    const calls: FetchCall[] = [];
    const fetchMock = mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : "",
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const writeMock = mock.method(fs, "writeFile", async () => undefined);
    const appendMock = mock.method(fs, "appendFile", async () => undefined);
    const logs = spyConsole();

    try {
      const leadRes = await postLead(
        post("/api/leads", {
          name: NAME,
          email: EMAIL,
          phone: PHONE,
          company: COMPANY,
          url: `https://${DOMAIN}/lead?email=${EMAIL}`,
          message: COMMENT,
          consent: true,
          consent_text_version: CONSENT,
          source: "landing",
        }),
      );
      assert.equal(leadRes.status, 201);
      const leadBody = (await leadRes.json()) as {
        ok?: boolean;
        id?: string;
        consent_text_version?: string;
      };
      assert.equal(leadBody.ok, true);
      assert.equal(typeof leadBody.id, "string");
      assert.equal(leadBody.consent_text_version, LEAD_CONSENT_TEXT_VERSION);
      assert.equal(JSON.stringify(leadBody).includes(CONSENT), false);
      assert.deepEqual(Object.keys(leadBody).sort(), ["consent_text_version", "id", "ok"]);

      const checkRes = await postCheck(
        post("/api/checks", {
          url: `https://${DOMAIN}/`,
          lead: {
            name: NAME,
            email: EMAIL,
            phone: PHONE,
            consent: true,
            consent_text_version: CONSENT,
          },
        }),
      );
      assert.equal(checkRes.status, 201);
      const checkText = await checkRes.text();
      for (const marker of MARKERS) {
        assert.equal(checkText.includes(marker), false, marker);
      }

      const directLead: Lead = {
        id: "lead-marker-q7",
        name: NAME,
        email: EMAIL,
        phone: PHONE,
        company: COMPANY,
        url: `https://${DOMAIN}/lead?email=${EMAIL}`,
        message: COMMENT,
        consent: true,
        consent_text_version: CONSENT,
        createdAt: new Date().toISOString(),
        source: "landing",
      };
      await notifyNewLead(directLead);

      const sent = telegramText(calls);
      assert.equal(sent.includes(leadBody.id!), true);
      assert.equal(sent.includes(DOMAIN), true);
      assert.equal(sent.includes("Балл:"), true);
      assert.equal(sent.includes(`https://persdannye.ru/cabinet/${leadBody.id}`), true);
      assert.equal(sent.includes("https://persdannye.ru/cabinet/lead-marker-q7"), true);
      for (const marker of MARKERS) {
        assert.equal(sent.includes(marker), false, marker);
        assert.equal(JSON.stringify(calls).includes(marker), false, marker);
      }
      assert.equal(sent.includes(CONSENT), false);
      assert.equal(JSON.stringify(calls).includes(CONSENT), false);
      assert.equal(
        calls.some((call) => call.url.includes("sendDocument")),
        false,
      );

      const stored = JSON.stringify([writeMock.mock.calls, appendMock.mock.calls]);
      for (const marker of MARKERS) {
        assert.equal(stored.includes(marker), false, marker);
        assert.equal(logs.text().includes(marker), false, marker);
      }
      assert.equal(writeMock.mock.calls.length, 0);
      assert.equal(appendMock.mock.calls.length, 0);
      assert.equal(fetchMock.mock.calls.length > 0, true);
    } finally {
      logs.restore();
    }
  });

  it("does not call sendDocument when a finished scan has a PDF and risks", async () => {
    enableCollection();
    enableTelegram();
    process.env.PARSER_API_BASE = "https://parser.invalid";
    process.env.PARSER_API_TOKEN = "parser-token";
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;

    const calls: FetchCall[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        body: typeof init?.body === "string" ? init.body : "",
      });
      if (url.includes("/pdf")) {
        return new Response(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const writeMock = mock.method(fs, "writeFile", async () => undefined);
    const appendMock = mock.method(fs, "appendFile", async () => undefined);
    const logs = spyConsole();

    const job: CheckJob = {
      id: "scan-marker-q7",
      scanId: "scan-marker-q7",
      url: `https://${DOMAIN}/form?email=${EMAIL}&name=${NAME}`,
      domain: DOMAIN,
      phase: "done",
      phaseMessage: COMMENT,
      score: 17,
      findings: [
        {
          rule_id: "P01",
          title: NAME,
          fact: `${EMAIL} ${PHONE} ${COMPANY} ${COMMENT}`,
          severity: "high",
        },
      ],
      hasRisks: true,
      push: true,
      pdfReady: true,
      mock: false,
      contact: {
        name: NAME,
        email: EMAIL,
        phone: PHONE,
        source: "landing",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await notifyScanIfNeeded(job);
      const sent = telegramText(calls);
      assert.equal(sent.includes("scan-marker-q7"), true);
      assert.equal(sent.includes(DOMAIN), true);
      assert.equal(sent.includes("Балл: 17"), true);
      assert.equal(sent.includes("https://persdannye.ru/cabinet/scan-marker-q7"), true);
      for (const marker of MARKERS) {
        assert.equal(sent.includes(marker), false, marker);
        assert.equal(JSON.stringify(calls).includes(marker), false, marker);
        assert.equal(logs.text().includes(marker), false, marker);
      }
      assert.equal(
        calls.some((call) => call.url.includes("sendDocument")),
        false,
      );
      const stored = JSON.stringify([writeMock.mock.calls, appendMock.mock.calls]);
      for (const marker of MARKERS) assert.equal(stored.includes(marker), false, marker);
      assert.equal(writeMock.mock.calls.length, 0);
      assert.equal(appendMock.mock.calls.length, 0);
    } finally {
      logs.restore();
    }
  });

  it("returns an error code from the check status route and does not log the upstream body", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "https://parser.invalid";
    process.env.PARSER_API_TOKEN = "parser-token";
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    mock.method(globalThis, "fetch", async () => {
      return new Response(`parser failed ${EMAIL} ${PHONE} ${COMMENT}`, {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
    });
    const writeMock = mock.method(fs, "writeFile", async () => undefined);
    const appendMock = mock.method(fs, "appendFile", async () => undefined);
    const logs = spyConsole();

    try {
      const res = await getCheck(new Request("http://localhost/api/checks/scan-marker-q7"), {
        params: Promise.resolve({ id: "scan-marker-q7" }),
      });
      assert.equal(res.status, 500);
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, "server_error");
      const packed = `${JSON.stringify(body)}\n${logs.text()}\n${JSON.stringify([
        writeMock.mock.calls,
        appendMock.mock.calls,
      ])}`;
      for (const marker of [EMAIL, PHONE, COMMENT, NAME]) {
        assert.equal(packed.includes(marker), false, marker);
      }
    } finally {
      logs.restore();
    }
  });

  it("rejects a scan id outside the allowlist before any parser fetch", async () => {
    enableCollection();
    enableTelegram();
    process.env.PARSER_API_BASE = "https://parser.invalid";
    process.env.PARSER_API_TOKEN = "parser-token";
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;

    let fetches = 0;
    mock.method(globalThis, "fetch", async () => {
      fetches += 1;
      return new Response("should-not-run", { status: 500 });
    });

    const rejected = ["../", "%2F", " ", "", "a".repeat(65), "проверка"];
    for (const id of rejected) {
      const before = fetches;
      for (const load of [getCheck, getCheckPdf]) {
        const res = await load(new Request("http://localhost/api/checks/id"), {
          params: Promise.resolve({ id }),
        });
        assert.equal(res.status, 400, JSON.stringify(id));
        assert.deepEqual(await res.json(), { error: "invalid_id" });
      }
      assert.equal(fetches, before, JSON.stringify(id));
    }

    const id = "scan-ok-1";
    const status = await getCheck(new Request("http://localhost/api/checks/scan-ok-1"), {
      params: Promise.resolve({ id }),
    });
    assert.notEqual(status.status, 400);
    const statusBody = (await status.json()) as { error?: string };
    assert.notEqual(statusBody.error, "invalid_id");
    assert.equal(fetches > 0, true);

    const afterStatus = fetches;
    const pdf = await getCheckPdf(new Request("http://localhost/api/checks/scan-ok-1/pdf"), {
      params: Promise.resolve({ id }),
    });
    assert.notEqual(pdf.status, 400);
    const pdfBody = (await pdf.json()) as { error?: string };
    assert.notEqual(pdfBody.error, "invalid_id");
    assert.equal(fetches > afterStatus, true);
  });

  it("returns an error code for a failed scan create and pdf fetch without the parser body", async () => {
    enableCollection();
    process.env.PARSER_API_BASE = "https://parser.invalid";
    process.env.PARSER_API_TOKEN = "parser-token";
    delete process.env.PARSER_API_EMAIL;
    delete process.env.PARSER_API_PASSWORD;
    const marker = "upstream-parser-body-q7";
    mock.method(globalThis, "fetch", async () => {
      return new Response(marker, {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
    });
    const logs = spyConsole();
    try {
      const created = await postCheck(post("/api/checks", { url: "https://example.com" }));
      assert.equal(created.status, 500);
      const createdBody = (await created.json()) as { error?: string };
      assert.equal(createdBody.error, "server_error");
      assert.equal(JSON.stringify(createdBody).includes(marker), false);

      const pdf = await getCheckPdf(new Request("http://localhost/api/checks/pdf-ok/pdf"), {
        params: Promise.resolve({ id: "pdf-ok" }),
      });
      assert.equal(pdf.status, 500);
      const pdfBody = (await pdf.json()) as { error?: string };
      assert.equal(pdfBody.error, "server_error");
      assert.equal(JSON.stringify(pdfBody).includes(marker), false);
      assert.equal(logs.text().includes(marker), false);
    } finally {
      logs.restore();
    }
  });
});

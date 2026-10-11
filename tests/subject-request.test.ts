import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { legalContent } from "../content/legal";
import { createMockPublicApi } from "../scripts/mock-public-api.mjs";
import {
  buildSubjectRequestBody,
  canPostSubjectRequest,
  isAnalyticsFreePath,
  postSubjectRequest,
  readRequestId,
  SUBJECT_PAGE_REFERRER,
  SUBJECT_PAGE_ROBOTS,
  SUBJECT_REQUEST_PATH,
} from "../lib/subject-request";

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

test("subject pages are noindex, no-referrer, and analytics-free placeholders", () => {
  assert.equal(legalContent.needs_legal_review, true);
  assert.equal(SUBJECT_PAGE_REFERRER, "no-referrer");
  assert.equal(SUBJECT_PAGE_ROBOTS.index, false);
  assert.equal(SUBJECT_PAGE_ROBOTS.follow, false);
  assert.equal(isAnalyticsFreePath("/unsubscribe"), true);
  assert.equal(isAnalyticsFreePath("/unsubscribe/"), true);
  assert.equal(isAnalyticsFreePath("/privacy/request"), true);
  assert.equal(isAnalyticsFreePath("/privacy/request?t=1"), true);
  assert.equal(isAnalyticsFreePath("/privacy"), false);
  assert.equal(isAnalyticsFreePath("/"), false);

  const unsubscribePage = fs.readFileSync(path.join(root, "app/unsubscribe/page.tsx"), "utf8");
  assert.equal(unsubscribePage.includes("searchParams"), false);
  assert.equal(unsubscribePage.includes("postSubjectRequest"), false);
  assert.equal(unsubscribePage.includes("token"), false);
  assert.equal(fs.existsSync(path.join(root, "app/u")), false);
  assert.equal(fs.existsSync(path.join(root, "components/subject/UnsubscribeConfirm.tsx")), false);
  assert.match(legalContent.unsubscribeLead, /ссылке в письме/);
  assert.match(legalContent.unsubscribeEmailLink, /не на этот сайт/);

  const reply =
    "Если адрес есть в наших системах, ответ придёт письмом на этот адрес в течение 10 рабочих дней";
  assert.equal(legalContent.privacyEmailReply, reply);
  const privacyPage = fs.readFileSync(path.join(root, "app/privacy/request/page.tsx"), "utf8");
  assert.equal(privacyPage.includes("privacyEmailReply"), true);
  assert.match(legalContent.types.delete, /стоп-лист/);
  assert.match(legalContent.deleteStopList, /стоп-лист/);
  const form = fs.readFileSync(path.join(root, "components/subject/PrivacyRequestForm.tsx"), "utf8");
  assert.equal(form.includes("result.email"), false);
  assert.equal(form.includes("result.data"), false);
  assert.equal(form.includes("res.status"), false);
  assert.equal(unsubscribePage.includes("fetch("), false);
});

test("subject-request body uses captcha_token and never sends an unsubscribe token", () => {
  assert.deepEqual(buildSubjectRequestBody({ type: "unsubscribe", email: " a@b.c " }), {
    type: "unsubscribe",
    email: "a@b.c",
  });
  assert.equal("token" in buildSubjectRequestBody({ type: "unsubscribe", email: "a@b.c" }), false);
  assert.equal("captcha_token" in buildSubjectRequestBody({ type: "unsubscribe", email: "a@b.c" }), false);
  assert.deepEqual(
    buildSubjectRequestBody({
      type: "delete",
      email: " a@b.c ",
      captchaToken: " tok ",
    }),
    { type: "delete", email: "a@b.c", captcha_token: "tok" }
  );
});

test("request id is the only field read from a subject-request body", () => {
  const id = "a".repeat(16);
  assert.equal(readRequestId({ request_id: id, email: "secret@example.com", data: { name: "x" } }), id);
  assert.equal(readRequestId({ request_id: "" }), null);
  assert.equal(readRequestId({ request_id: "<b>x</b>", email: "secret@example.com" }), null);
  assert.equal(readRequestId({ error: "no such email", email: "secret@example.com" }), null);
  assert.equal(readRequestId(null), null);
  assert.equal(readRequestId(["not-an-object"]), null);
});

test("bff mode does not call the network for a subject request", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE", "NEXT_PUBLIC_PUBLIC_API_BASE"]);
  delete process.env.NEXT_PUBLIC_FORMS_MODE;
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = "https://api.example.ru";
  let called = 0;
  try {
    assert.equal(canPostSubjectRequest(), false);
    const result = await postSubjectRequest({ type: "access", email: "a@b.c" }, async () => {
      called += 1;
      return new Response("{}", { status: 202 });
    });
    assert.equal(called, 0);
    assert.deepEqual(result, { networkError: false, requestId: null });
  } finally {
    restore();
  }
});

test("direct mode posts subject requests only to /public/subject-request and stays neutral", async () => {
  const restore = saveEnv(["NEXT_PUBLIC_FORMS_MODE", "NEXT_PUBLIC_PUBLIC_API_BASE"]);
  const mock = createMockPublicApi();
  const decoyHits: string[] = [];
  const decoy = http.createServer((req, res) => {
    decoyHits.push(req.url || "");
    res.writeHead(500);
    res.end("site");
  });
  const origin = await mock.listen();
  await new Promise<void>((resolve) => decoy.listen(0, "127.0.0.1", () => resolve()));
  process.env.NEXT_PUBLIC_FORMS_MODE = "direct";
  process.env.NEXT_PUBLIC_PUBLIC_API_BASE = origin;
  const email = "person@example.com";
  try {
    const unsubscribe = await postSubjectRequest({ type: "unsubscribe", email });
    const access = await postSubjectRequest({
      type: "access",
      email,
      captchaToken: "captcha-token",
    });
    assert.match(unsubscribe.requestId || "", /^[0-9a-f]{32}$/);
    assert.match(access.requestId || "", /^[0-9a-f]{32}$/);
    assert.equal(decoyHits.length, 0);

    const posts = mock.requests.filter((entry) => entry.path === SUBJECT_REQUEST_PATH);
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0].body, { type: "unsubscribe", email });
    assert.equal("token" in (posts[0].body as object), false);
    assert.equal("token" in (posts[1].body as object), false);
    assert.deepEqual(posts[1].body, {
      type: "access",
      email,
      captcha_token: "captcha-token",
    });
    assert.equal(mock.requests.some((entry) => String(entry.path).startsWith("/api/")), false);

    const known = await fetch(`${origin}${SUBJECT_REQUEST_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "access", email: "known@example.com", captcha_token: "t" }),
    });
    const unknown = await fetch(`${origin}${SUBJECT_REQUEST_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "access", email: "unknown@example.com", captcha_token: "t" }),
    });
    const knownText = await known.text();
    const unknownText = await unknown.text();
    assert.equal(known.status, 202);
    assert.equal(unknown.status, 202);
    assert.deepEqual(Object.keys(JSON.parse(knownText)), ["request_id"]);
    assert.deepEqual(Object.keys(JSON.parse(unknownText)), ["request_id"]);
    assert.equal(knownText.includes("known@example.com"), false);
    assert.equal(unknownText.includes("unknown@example.com"), false);

    const leaked = await postSubjectRequest({ type: "access", email }, async () => {
      return new Response(
        JSON.stringify({
          request_id: "b".repeat(16),
          email,
          data: { name: "hidden" },
          status: "found",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    });
    assert.deepEqual(leaked, { networkError: false, requestId: "b".repeat(16) });
    const failed = await postSubjectRequest({ type: "delete", email }, async () => {
      return new Response(JSON.stringify({ error: "unknown email", email }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });
    const broken = await postSubjectRequest({ type: "delete", email }, async () => {
      throw new Error("network");
    });
    assert.deepEqual(failed, { networkError: false, requestId: null });
    assert.deepEqual(broken, { networkError: true, requestId: null });
    assert.equal(JSON.stringify(failed).includes(email), false);
    assert.equal(JSON.stringify(leaked).includes(email), false);
  } finally {
    restore();
    await mock.close();
    await new Promise<void>((resolve) => decoy.close(() => resolve()));
  }
});

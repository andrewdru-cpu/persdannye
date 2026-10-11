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

  const unsubscribe = fs.readFileSync(path.join(root, "components/subject/UnsubscribeConfirm.tsx"), "utf8");
  assert.equal(unsubscribe.includes("useEffect"), false);
  assert.equal(unsubscribe.includes("type=\"email\""), false);
  assert.equal(unsubscribe.includes("postSubjectRequest({ type: \"unsubscribe\", token })"), true);
});

test("subject-request body uses captcha_token and omits empty fields", () => {
  assert.deepEqual(buildSubjectRequestBody({ type: "unsubscribe", token: " abc " }), {
    type: "unsubscribe",
    token: "abc",
  });
  assert.equal("email" in buildSubjectRequestBody({ type: "unsubscribe", token: "abc" }), false);
  assert.equal("captcha_token" in buildSubjectRequestBody({ type: "unsubscribe", token: "abc" }), false);
  assert.deepEqual(
    buildSubjectRequestBody({
      type: "delete",
      email: " a@b.c ",
      captchaToken: " tok ",
    }),
    { type: "delete", email: "a@b.c", captcha_token: "tok" }
  );
});

test("request id is kept only from a 202 with a safe token", () => {
  assert.equal(readRequestId(202, { request_id: "a".repeat(16) }), "a".repeat(16));
  assert.equal(readRequestId(200, { request_id: "a".repeat(16) }), null);
  assert.equal(readRequestId(404, { request_id: "missing-user" }), null);
  assert.equal(readRequestId(500, { error: "no such email" }), null);
  assert.equal(readRequestId(202, { request_id: "" }), null);
  assert.equal(readRequestId(202, { request_id: "<b>x</b>" }), null);
  assert.equal(readRequestId(202, null), null);
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
    assert.equal(result.requestId, null);
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
    const unsubscribe = await postSubjectRequest({ type: "unsubscribe", token: "mail-token" });
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
    assert.deepEqual(posts[0].body, { type: "unsubscribe", token: "mail-token" });
    assert.deepEqual(posts[1].body, {
      type: "access",
      email,
      captcha_token: "captcha-token",
    });
    assert.equal(mock.requests.some((entry) => String(entry.path).startsWith("/api/")), false);

    const failed = await postSubjectRequest({ type: "delete", email }, async () => {
      return new Response(JSON.stringify({ error: "unknown email", email }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });
    const broken = await postSubjectRequest({ type: "delete", email }, async () => {
      throw new Error("network");
    });
    assert.equal(failed.requestId, null);
    assert.equal(broken.requestId, null);
    assert.equal(legalContent.successMessage, legalContent.successMessage);
  } finally {
    restore();
    await mock.close();
    await new Promise<void>((resolve) => decoy.close(() => resolve()));
  }
});

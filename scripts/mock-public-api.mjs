/**
 * Local stand-in for the parser public API.
 * POST /public/check -> 202 { check_id, report_url }
 * GET  /public/check/:id -> findings only (no stored contacts)
 * GET  /public/check/:id/pdf
 * POST /public/lead -> 201
 * POST /public/subject-request -> always 202 { request_id }
 *   Same body for every email. access carries no personal data.
 *
 * Contacts without consent.accepted and text_version -> 422 consent_required.
 * text_version outside CONSENT_TEXT_VERSIONS -> 422 consent_version_unknown.
 * The allowlist matches content/consent.ts (persdannye#4): "2026-10-11".
 * The status payload deliberately includes contact-like fields so the site
 * client can prove it drops them.
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

function send(res, status, body, contentType = "application/json; charset=utf-8", extraHeaders = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

const CONSENT_TEXT_VERSIONS = new Set(["2026-10-11"]);

function consentError(body) {
  const consent = body?.consent;
  if (consent?.accepted !== true || typeof consent?.text_version !== "string" || !consent.text_version) {
    return "consent_required";
  }
  if (!CONSENT_TEXT_VERSIONS.has(consent.text_version)) return "consent_version_unknown";
  return null;
}

function hasContacts(body) {
  const contacts = body?.contacts;
  if (!contacts || typeof contacts !== "object") return false;
  return Boolean(contacts.name || contacts.email || contacts.phone);
}

export function createMockPublicApi() {
  /** @type {Map<string, { url: string, reportUrl: string }>} */
  const checks = new Map();
  /** @type {{ method: string, path: string, body: unknown, idempotencyKey: string }[]} */
  const requests = [];
  /** @type {Map<string, { hash: string, id: string, tries: number }>} */
  const leadKeys = new Map();

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      send(res, 400, { error: "bad_request" });
      return;
    }
    if (req.method === "OPTIONS") {
      send(res, 204, "");
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }
    requests.push({
      method: req.method,
      path: url.pathname,
      body,
      idempotencyKey: typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : "",
    });

    if (req.method === "POST" && url.pathname === "/public/check") {
      if (!body || typeof body.smart_token !== "string" || !body.smart_token.trim()) {
        send(res, 400, { error: "captcha_required" });
        return;
      }
      if (hasContacts(body)) {
        const consentCode = consentError(body);
        if (consentCode) {
          send(res, 422, { error: consentCode });
          return;
        }
      }
      const checkId = randomBytes(32).toString("hex");
      const token = randomBytes(32).toString("hex");
      const origin = `http://127.0.0.1:${server.address()?.port ?? 8787}`;
      const reportUrl = `${origin}/r/${token}`;
      checks.set(checkId, { url: String(body.url || ""), reportUrl });
      send(res, 202, { check_id: checkId, report_url: reportUrl });
      return;
    }

    const pdf = url.pathname.match(/^\/public\/check\/([^/]+)\/pdf$/);
    if (req.method === "GET" && pdf) {
      const id = decodeURIComponent(pdf[1]);
      if (!checks.has(id)) {
        send(res, 404, { error: "not_found" });
        return;
      }
      send(res, 200, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "application/pdf");
      return;
    }

    const one = url.pathname.match(/^\/public\/check\/([^/]+)$/);
    if (req.method === "GET" && one) {
      const id = decodeURIComponent(one[1]);
      const check = checks.get(id);
      if (!check) {
        send(res, 404, { error: "not_found" });
        return;
      }
      const host = String(check.url).toLowerCase();
      const robotsPartial = host.includes("robots") || host.includes("disallow");
      send(res, 200, {
        check_id: id,
        status: "done",
        url: check.url,
        score: robotsPartial ? 64 : 37,
        pdf_ready: true,
        inn: robotsPartial ? null : "7707083893",
        org_name: robotsPartial ? null : "ООО Пример",
        ...(robotsPartial ? { mode: "static_fallback", rules_version: "2026.10" } : {}),
        findings: robotsPartial
          ? [
              {
                rule_id: "H01",
                title: "Главная страница",
                fact: "На главной нет ссылки на политику обработки ПДн.",
                severity: "S",
                status: "violation",
                status_basis: "proven",
                fine_norm: "ч. 3 ст. 13.11 КоАП",
                fine_interpretation: false,
                fine_amount_text: null,
                meta: { disclaimer: "Проверены главная страница и документ политики.", screenshot: "hidden" },
              },
              {
                rule_id: "P01",
                title: "Политика обработки ПДн",
                fact: "В политике не указан срок обработки.",
                severity: "B",
                status: "violation",
                status_basis: "likely",
                fine_norm: "ч. 3 ст. 13.11 КоАП",
                fine_interpretation: true,
                fine_amount_text: "до 300 000 ₽",
                meta: { disclaimer: "Квалификацию этой формулировки оценивает юрист." },
              },
              {
                rule_id: "F03",
                title: "Формы на внутренних страницах",
                fact: "Страницы не открывались: robots.txt содержит Disallow: /.",
                severity: "A",
                status: "not_checked",
                reason: "robots_disallow",
              },
            ]
          : [
              {
                rule_id: "P01",
                title: "Нет политики",
                fact: "Документ по ст. 18.1 не найден. [контактные данные скрыты]",
                severity: "high",
                screenshot: "data:image/png;base64,AAAA",
              },
            ],
        inventory: robotsPartial
          ? [
              {
                checklist_item_id: "policy-link",
                title: "Ссылка на политику",
                detail: "На главной ссылка есть в подвале.",
                status: "violation",
                fine_norm: "ч. 1 ст. 13.11 КоАП",
                hidden: true,
                email: "secret@example.com",
              },
              {
                checklist_item_id: "cookie-note",
                title: "Упоминание cookie",
                detail: "В подвале есть короткое упоминание cookie.",
              },
            ]
          : [
              {
                checklist_item_id: "home-policy",
                title: "Политика на главной",
                detail: "Ссылка в подвале есть.",
                status: "hidden",
                screenshot: "data:image/png;base64,CCCC",
              },
            ],
        contacts: { name: "SHOULD_NOT_RENDER", email: "secret@example.com", phone: "+79990000000" },
        screenshots: ["data:image/png;base64,BBBB"],
        lead: { email: "secret@example.com" },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/public/subject-request") {
      // Confirmed contract (parser PR #5): always 202 {request_id}.
      // Known and unknown emails get the same body. Nothing else is returned;
      // an access reply is emailed, and delete also stop-lists the address.
      send(res, 202, { request_id: randomBytes(16).toString("hex") });
      return;
    }

    if (req.method === "POST" && url.pathname === "/public/lead") {
      if (Buffer.byteLength(raw) > 16 * 1024) {
        send(res, 400, { error: "validation_failed", fields: ["message"] });
        return;
      }
      const idempotencyKey = req.headers["idempotency-key"];
      const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (typeof idempotencyKey !== "string" || !uuidV4.test(idempotencyKey)) {
        send(res, 400, { error: "idempotency_key_invalid" });
        return;
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        send(res, 400, { error: "validation_failed", fields: ["name"] });
        return;
      }
      const allowed = new Set([
        "name",
        "email",
        "phone",
        "url",
        "check_id",
        "message",
        "source",
        "consent",
        "marketing_consent",
        "smart_token",
      ]);
      const extra = Object.keys(body).filter((key) => !allowed.has(key));
      if (extra.length) {
        send(res, 400, { error: "validation_failed", fields: extra });
        return;
      }
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const fields = [];
      if (name.length < 2 || name.length > 120) fields.push("name");
      if (!email && !phone) fields.push("email", "phone");
      if (email && (email.length > 200 || !email.includes("@"))) fields.push("email");
      if (phone.length > 40) fields.push("phone");
      if (typeof body.url === "string" && body.url && !/^https?:\/\//i.test(body.url)) fields.push("url");
      if (fields.length) {
        send(res, 400, { error: "validation_failed", fields });
        return;
      }
      const consent = body.consent;
      if (!consent || consent.accepted !== true) {
        send(res, 422, { error: "consent_required" });
        return;
      }
      if (consent.text_version !== "2026-10-11-lead") {
        send(res, 422, { error: "consent_version_unknown" });
        return;
      }
      if ("marketing_consent" in body) {
        const marketing = body.marketing_consent;
        if (!email || !marketing || marketing.accepted !== true || marketing.text_version !== "2026-10-11-marketing") {
          send(res, 400, { error: "validation_failed", fields: ["marketing_consent"] });
          return;
        }
      }
      if (typeof body.smart_token !== "string" || !body.smart_token.trim()) {
        send(res, 400, { error: "captcha_required" });
        return;
      }
      const hash = JSON.stringify(body);
      const previous = leadKeys.get(idempotencyKey);
      if (previous && previous.hash !== hash) {
        send(res, 422, { error: "idempotency_key_reused" });
        return;
      }
      if (previous?.id) {
        send(res, 201, { ok: true, id: previous.id });
        return;
      }
      const token = body.smart_token;
      const tries = previous?.tries || 0;
      if (token === "busy" && tries < 1) {
        leadKeys.set(idempotencyKey, { hash, id: "", tries: tries + 1 });
        send(res, 409, { error: "idempotency_in_progress" });
        return;
      }
      if (token === "unavailable" && tries < 1) {
        leadKeys.set(idempotencyKey, { hash, id: "", tries: tries + 1 });
        send(res, 503, { error: "captcha_unavailable" }, "application/json; charset=utf-8", { "Retry-After": "0" });
        return;
      }
      if (token === "limit") {
        send(res, 429, { error: "rate_limited" }, "application/json; charset=utf-8", { "Retry-After": "1" });
        return;
      }
      if (token === "bad") {
        send(res, 403, { error: "captcha_failed" });
        return;
      }
      if (token === "origin") {
        send(res, 403, { error: "origin_forbidden" });
        return;
      }
      const id = randomBytes(16).toString("hex");
      leadKeys.set(idempotencyKey, { hash, id, tries: tries + 1 });
      send(res, 201, { ok: true, id });
      return;
    }

    send(res, 404, { error: "not_found" });
  });

  return {
    requests,
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server.listen(port, "127.0.0.1", () => {
          const address = server.address();
          if (!address || typeof address === "string") {
            reject(new Error("mock listen failed"));
            return;
          }
          resolve(`http://127.0.0.1:${address.port}`);
        });
      });
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.MOCK_PUBLIC_API_PORT || 8787);
  const mock = createMockPublicApi();
  mock.listen(port).then((origin) => {
    console.log(`mock public api ${origin}`);
  });
}

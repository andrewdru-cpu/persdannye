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
 * The status payload deliberately includes contact-like fields so the site
 * client can prove it drops them.
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function hasContacts(body) {
  const contacts = body?.contacts;
  if (!contacts || typeof contacts !== "object") return false;
  return Boolean(contacts.name || contacts.email || contacts.phone);
}

export function createMockPublicApi() {
  /** @type {Map<string, { url: string, reportUrl: string }>} */
  const checks = new Map();
  /** @type {{ method: string, path: string, body: unknown }[]} */
  const requests = [];

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
    requests.push({ method: req.method, path: url.pathname, body });

    if (req.method === "POST" && url.pathname === "/public/check") {
      if (!body || typeof body.smart_token !== "string" || !body.smart_token.trim()) {
        send(res, 400, { error: "captcha_required" });
        return;
      }
      if (hasContacts(body)) {
        const consent = body.consent;
        if (consent?.accepted !== true || typeof consent?.text_version !== "string" || !consent.text_version) {
          send(res, 422, { error: "consent_required" });
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
                fact: "Документ по ст. 18.1 не найден.",
                severity: "high",
                screenshot: "data:image/png;base64,AAAA",
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
      const consent = body?.consent;
      if (consent?.accepted !== true || typeof consent?.text_version !== "string" || !consent.text_version) {
        send(res, 422, { error: "consent_required" });
        return;
      }
      if (typeof body?.smart_token !== "string" || !body.smart_token.trim()) {
        send(res, 400, { error: "captcha_required" });
        return;
      }
      send(res, 201, { id: randomBytes(16).toString("hex") });
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

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer } from "../components/layout/Footer.tsx";
import { GatedLegalPage } from "../components/legal/GatedLegalPage.tsx";
import DataDeletionPage, { metadata as dataDeletionMeta } from "../app/data-deletion/page.tsx";
import CookiesPage, { metadata as cookiesMeta } from "../app/cookies/page.tsx";
import OfferPage, { metadata as offerMeta } from "../app/offer/page.tsx";
import PrivacyPage, { metadata as privacyMeta } from "../app/privacy/page.tsx";
import RefundPage, { metadata as refundMeta } from "../app/refund/page.tsx";
import TermsPage, { metadata as termsMeta } from "../app/terms/page.tsx";
import { flags } from "./flags.ts";
import type { LegalDocument } from "./legal-documents.ts";
import { visibleFooterDocuments } from "./legal-nav.ts";
import { LEGAL_PENDING_TEXT, legalRobots } from "./legal-publication.ts";
import { requisiteIdLine, visibleRequisite } from "../lib/requisite-lines.ts";
import { SITE_LEGAL_SUBJECTS_CLAUSE, siteLegalPrivacyMarkers } from "./site-legal.ts";

const noindex = { index: false, follow: false } as const;

const cookieMarkers = [
  "Cookie — небольшие фрагменты данных",
  "Редакция от 21.09.2026",
] as const;

const termsMarkers = [
  "Настоящее соглашение является публичной офертой",
  "Редакция от 21.09.2026",
] as const;

const sampleOffer: LegalDocument = {
  title: "Оферта",
  edition: "Редакция теста",
  blocks: ["акцепт оферты ждёт юриста"],
};

function markup(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? "");
}

function readSource(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

function withFlags(patch: Partial<typeof flags>, run: () => void) {
  const previous = { ...flags };
  Object.assign(flags, patch);
  try {
    run();
  } finally {
    Object.assign(flags, previous);
  }
}

describe("legal page flags", { concurrency: 1 }, () => {
  it("keeps a page noindex until both the flag and the document text are on", () => {
    assert.deepEqual(legalRobots(false, null), noindex);
    assert.deepEqual(legalRobots(true, null), noindex);
    assert.deepEqual(legalRobots(false, sampleOffer), noindex);
    assert.equal(legalRobots(true, sampleOffer), undefined);
    assert.deepEqual(offerMeta.robots, noindex);
    assert.deepEqual(refundMeta.robots, noindex);
    assert.deepEqual(dataDeletionMeta.robots, noindex);
    assert.deepEqual(cookiesMeta.robots, noindex);
    assert.deepEqual(termsMeta.robots, noindex);
  });

  it("renders a pending stub without document text when the gate is closed", () => {
    const hidden = markup(
      createElement(GatedLegalPage, { show: false, document: sampleOffer, title: "Оферта" }),
    );
    const missing = markup(
      createElement(GatedLegalPage, { show: true, document: null, title: "Оферта" }),
    );
    for (const html of [hidden, missing]) {
      assert.equal(html.includes(LEGAL_PENDING_TEXT), true);
      assert.equal(html.includes(sampleOffer.blocks[0]!), false);
      assert.equal(html.includes("notFound"), false);
    }
    const shown = markup(
      createElement(GatedLegalPage, { show: true, document: sampleOffer, title: "Оферта" }),
    );
    assert.equal(shown.includes(LEGAL_PENDING_TEXT), false);
    assert.equal(shown.includes(sampleOffer.blocks[0]!), true);
  });

  it("renders offer, refund, and data deletion as noindex stubs", () => {
    const pages = [
      { source: "app/offer/page.tsx", flag: "show_offer", Page: OfferPage, title: "Оферта" },
      { source: "app/refund/page.tsx", flag: "show_refund", Page: RefundPage, title: "Возврат" },
      {
        source: "app/data-deletion/page.tsx",
        flag: "show_data_deletion",
        Page: DataDeletionPage,
        title: "Удаление данных",
      },
    ] as const;
    for (const item of pages) {
      const source = readSource(item.source);
      assert.equal(source.includes(`flags.${item.flag}`), true, item.source);
      assert.equal(source.includes("notFound("), false, item.source);
      const html = markup(createElement(item.Page));
      assert.equal(html.includes(LEGAL_PENDING_TEXT), true, item.title);
      assert.equal(html.includes(item.title), true, item.title);
      assert.equal(html.includes(sampleOffer.blocks[0]!), false, item.title);
    }
  });

  it("renders cookies and terms as noindex stubs without their document markers", () => {
    const pages = [
      {
        source: "app/cookies/page.tsx",
        flag: "show_cookie_policy",
        Page: CookiesPage,
        markers: cookieMarkers,
      },
      {
        source: "app/terms/page.tsx",
        flag: "show_terms",
        Page: TermsPage,
        markers: termsMarkers,
      },
    ] as const;
    for (const item of pages) {
      const source = readSource(item.source);
      assert.equal(source.includes(`if (!flags.${item.flag})`), true, item.source);
      assert.equal(source.includes("LegalPending"), true, item.source);
      assert.equal(source.includes("notFound("), false, item.source);
      const html = markup(createElement(item.Page));
      assert.equal(html.includes(LEGAL_PENDING_TEXT), true, item.flag);
      for (const marker of item.markers) {
        assert.equal(html.includes(marker), false, marker);
      }
    }
  });

  it("renders the cookie and terms documents when their flags are substituted on", () => {
    withFlags({ show_cookie_policy: true, show_terms: true }, () => {
      const cookies = markup(createElement(CookiesPage));
      const terms = markup(createElement(TermsPage));
      assert.equal(cookies.includes(LEGAL_PENDING_TEXT), false);
      assert.equal(terms.includes(LEGAL_PENDING_TEXT), false);
      for (const marker of cookieMarkers) assert.equal(cookies.includes(marker), true, marker);
      for (const marker of termsMarkers) assert.equal(terms.includes(marker), true, marker);
      assert.equal(terms.includes("ИНН ,"), false);
      assert.equal(terms.includes("ОГРН "), false);
      assert.equal(cookies.includes("ИНН ,"), false);
      assert.equal(cookies.includes("ОГРН "), false);
      assert.equal(cookies.includes("тел."), false);
      assert.equal(requisiteIdLine("1098765432", "1234567890123"), "ИНН 1098765432, ОГРН 1234567890123");
      assert.equal(requisiteIdLine("", ""), null);
      assert.equal(visibleRequisite("ООО Пример"), "ООО Пример");
      assert.equal(visibleRequisite("  "), null);
    });
    assert.equal(flags.show_cookie_policy, false);
    assert.equal(flags.show_terms, false);
  });

  it("keeps the 21.09 privacy policy and hides site-legal markers", () => {
    assert.equal(flags.show_site_legal, false);
    assert.equal(privacyMeta.robots, undefined);
    const source = readSource("app/privacy/page.tsx");
    assert.equal(source.includes("notFound("), false);
    assert.equal(source.includes("LegalPending"), false);
    const html = markup(createElement(PrivacyPage));
    assert.equal(html.includes("Редакция от 21.09.2026"), true);
    assert.equal(html.includes("Настоящая Политика обработки персональных данных"), true);
    assert.equal(html.includes(LEGAL_PENDING_TEXT), false);
    assert.equal(html.includes('href="/cookies"'), true);
    assert.equal(html.includes(SITE_LEGAL_SUBJECTS_CLAUSE), false);
    for (const marker of siteLegalPrivacyMarkers) {
      assert.equal(html.includes(marker), false, marker);
    }
  });

  it("keeps the checkbox links to consent and the lead consent", () => {
    const fields = readSource("components/check/ReportConsentFields.tsx");
    const lead = readSource("components/landing/LeadForm.tsx");
    assert.equal(fields.includes("href={consentHref}"), true);
    assert.equal(fields.includes('consentHref = "/consent"'), true);
    assert.equal(fields.includes('href="/privacy"'), true);
    assert.equal(lead.includes('consentHref="/consent-lead"'), true);
  });

  it("hides footer links and requisites for disabled documents", () => {
    const html = markup(createElement(Footer));
    const links = hrefsOf(html);
    for (const href of ["/cookies", "/terms", "/offer", "/refund", "/data-deletion"]) {
      assert.equal(links.includes(href), false, href);
    }
    assert.equal(links.includes("/privacy"), true);
    assert.equal(links.includes("/applicability"), true);
    assert.equal(html.includes("Реквизиты не опубликованы"), true);
    assert.equal(html.includes("ИНН"), false);
    assert.deepEqual(visibleFooterDocuments().map((item) => item.href), ["/privacy", "/applicability"]);
  });

  it("shows footer links when document flags are substituted on", () => {
    withFlags(
      {
        show_cookie_policy: true,
        show_terms: true,
        show_offer: true,
        show_refund: true,
        show_data_deletion: true,
        show_requisites: true,
      },
      () => {
        const html = markup(createElement(Footer));
        const links = hrefsOf(html);
        for (const href of ["/cookies", "/terms", "/offer", "/refund", "/data-deletion", "/privacy"]) {
          assert.equal(links.includes(href), true, href);
        }
        assert.equal(html.includes("Политика cookie"), true);
        assert.equal(html.includes("Пользовательское соглашение"), true);
        assert.equal(html.includes("Оферта"), true);
        assert.equal(html.includes("Возврат"), true);
        assert.equal(html.includes("Порядок удаления данных"), true);
        assert.equal(html.includes("Реквизиты не опубликованы"), false);
        assert.equal(html.includes("ИНН"), true);
        assert.equal(html.includes("ОГРН"), true);
        assert.equal(html.includes("ООО Пример"), false);
        assert.equal(html.includes("ул. Примерная"), false);
      },
    );
    assert.equal(flags.show_offer, false);
    assert.equal(flags.show_requisites, false);
  });

  it("keeps the cookie banner link when the cookie policy flag is off", () => {
    const banner = readSource("components/layout/CookieBanner.tsx");
    assert.equal(banner.includes('href="/cookies"'), true);
    assert.equal(banner.includes('href="/privacy"'), true);
    assert.equal(banner.includes("show_cookie_policy"), false);
    assert.equal(banner.includes("flags"), false);
    const footer = markup(createElement(Footer));
    assert.equal(hrefsOf(footer).includes("/cookies"), false);
  });

  it("does not add gated document links outside the footer list, the banner, and published texts", () => {
    const expected: Record<string, string[]> = {
      "content/legal-nav.ts": ["/cookies", "/terms", "/offer", "/refund", "/data-deletion"],
      "components/layout/CookieBanner.tsx": ["/cookies"],
      "app/privacy/page.tsx": ["/cookies"],
      "app/terms/page.tsx": ["/cookies"],
    };
    const found = new Map<string, string[]>();
    const root = new URL("..", import.meta.url);
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx|ts|mts)$/.test(entry)) continue;
        const relative = path.relative(fileURL(root), full).split(path.sep).join("/");
        if (relative === "content/legal-pages.test.mts") continue;
        const hrefs = [
          ...readFileSync(full, "utf8").matchAll(
            /href(?:=|:)\s*"(\/(?:cookies|terms|offer|refund|data-deletion))"/g,
          ),
        ].map((match) => match[1] ?? "");
        if (hrefs.length > 0) found.set(relative, hrefs);
      }
    }
    walk(fileURL(root));
    assert.deepEqual(Object.fromEntries([...found.entries()].sort()), expected);
  });

  it(
    "serves the built offer, refund, and data-deletion pages with noindex",
    { skip: existsSync(path.join(fileURL(new URL("..", import.meta.url)), ".next", "BUILD_ID")) ? false : "нет сборки .next" },
    async () => {
      const root = fileURL(new URL("..", import.meta.url));
      const port = 3491;
      const origin = `http://127.0.0.1:${port}`;
      const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
        cwd: root,
        detached: true,
        stdio: "ignore",
      });
      try {
        const deadline = Date.now() + 30_000;
        let last = "сервер не ответил";
        while (Date.now() < deadline) {
          try {
            const probe = await fetch(`${origin}/offer`);
            if (probe.status === 200) break;
            last = String(probe.status);
          } catch (error) {
            last = error instanceof Error ? error.message : String(error);
          }
          if (Date.now() >= deadline) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const ready = await fetch(`${origin}/offer`);
        assert.equal(ready.status, 200, last);
        for (const route of ["/offer", "/refund", "/data-deletion"]) {
          const response = await fetch(`${origin}${route}`);
          assert.equal(response.status, 200, route);
          const html = await response.text();
          assert.match(html, /<meta name="robots" content="noindex,\s*nofollow"\s*\/?>/, route);
          assert.equal(html.includes(LEGAL_PENDING_TEXT), true, route);
        }
      } finally {
        if (child.pid) {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            child.kill("SIGTERM");
          }
        }
      }
    },
  );
});

function fileURL(url: URL): string {
  return url.pathname;
}

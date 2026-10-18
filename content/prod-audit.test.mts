import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { footerParagraphs, faqItems } from "./blocks.ts";
import { flags } from "./flags.ts";
import { notApplicableItems } from "./not-applicable.ts";
import { renderedLandingCopy } from "./landing.ts";
import { siteDescription } from "./site-meta.ts";
import { OPERATOR_REQUISITES_PENDING } from "../lib/company.ts";
import { legalPublication, unpublishedRobots } from "../lib/legal-publication.ts";
import { visiblePhaseCopy } from "../lib/phases.ts";
import {
  SITE_URL_FALLBACK,
  indexablePaths,
  robotsDocument,
  siteBaseUrl,
  sitePages,
  sitemapEntries,
} from "../lib/site-index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const appDir = join(root, "app");

const textNeedles = ["show_", "flow /u/", "Премиальный", "устраняйте их с юристами"] as const;
const usualSeconds = /обычно\s+\d/iu;

function collectStrings(value: unknown, out: string[], seen: WeakSet<object>): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, seen);
    return;
  }
  for (const item of Object.values(value)) collectStrings(item, out, seen);
}

function metadataBlock(source: string): string {
  const marker = "export const metadata";
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const brace = source.indexOf("{", start);
  if (brace < 0) return "";
  let depth = 0;
  let end = brace;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return source.slice(brace, end);
}

function quotedLiterals(source: string): string[] {
  const found: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g;
  for (const match of source.matchAll(re)) {
    found.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return found;
}

function walkPages(dir: string, pages: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "api" || entry === "fonts") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkPages(full, pages);
      continue;
    }
    if (entry !== "page.tsx") continue;
    const rel = full.slice(appDir.length).replace(/\\/g, "/").replace(/\/page\.tsx$/, "");
    pages.push(rel || "/");
  }
}

function appPagePaths(): string[] {
  const pages: string[] = [];
  walkPages(appDir, pages);
  return pages;
}

describe("public copy and metadata", () => {
  it("keeps internal markers and the old sales description out of text values", async () => {
    const texts: string[] = [];
    const seen = new WeakSet<object>();
    const contentDir = fileURLToPath(new URL(".", import.meta.url));
    for (const name of readdirSync(contentDir)) {
      if (!name.endsWith(".ts")) continue;
      const mod = await import(pathToFileURL(join(contentDir, name)).href);
      collectStrings(mod, texts, seen);
    }
    const metaFiles = [join(appDir, "layout.tsx"), ...appPagePaths().map((path) => {
      const rel = path === "/" ? "page.tsx" : `${path.slice(1)}/page.tsx`;
      return join(appDir, rel);
    })];
    for (const file of metaFiles) {
      texts.push(...quotedLiterals(metadataBlock(readFileSync(file, "utf8"))));
    }
    texts.push(siteDescription);
    const flagNames = new Set(Object.keys(flags));
    for (const text of texts) {
      if (flagNames.has(text)) continue;
      for (const needle of textNeedles) {
        assert.equal(text.includes(needle), false, `${needle} :: ${text.slice(0, 160)}`);
      }
    }
    const layout = readFileSync(join(appDir, "layout.tsx"), "utf8");
    assert.equal(layout.includes("Премиальный"), false);
    assert.equal(layout.includes("устраняйте их с юристами"), false);
    assert.equal(layout.includes("description: siteDescription"), true);
    assert.equal(
      siteDescription,
      "Автоматическая проверка публичных страниц сайта на признаки нарушений 152-ФЗ о персональных данных. Отчёт с наблюдениями и рекомендациями.",
    );
  });
});

describe("rendered production surface", () => {
  const footer = footerParagraphs(false).join("\n");
  const rendered = [
    renderedLandingCopy(),
    footer,
    OPERATOR_REQUISITES_PENDING,
    visiblePhaseCopy(),
    siteDescription,
    notApplicableItems.map((item) => `${item.mark}\n${item.reason}`).join("\n"),
  ].join("\n");

  it("hides placeholder requisites, the fines footnote, the absolute site host, and phase timings", () => {
    assert.equal(flags.show_fines, false);
    assert.equal(flags.show_requisites, false);
    assert.equal(flags.show_site_legal, false);
    assert.equal(flags.hero_speed_claim, false);
    assert.equal(rendered.includes("7700000000"), false);
    assert.equal(rendered.includes("1207700000000"), false);
    assert.equal(rendered.includes("000-00-00"), false);
    assert.equal(rendered.includes("persdannye.ru"), false);
    assert.equal(usualSeconds.test(rendered), false);
    assert.equal(footer.includes("13.11"), false);
    assert.equal(footer.includes("Точные суммы штрафов"), false);
    assert.equal(footer.includes("не гарантирует"), true);
    assert.equal(OPERATOR_REQUISITES_PENDING, "Реквизиты оператора будут опубликованы до начала обработки");
    assert.equal(usualSeconds.test(visiblePhaseCopy(true)), true);
    assert.equal(footerParagraphs(false, false, true).some((line) => line.includes("13.11")), true);
    assert.equal(footerParagraphs(false, true).some((line) => line.includes("ИНН")), true);
    const faq = faqItems(false).map((item) => item.a).join("\n");
    assert.equal(faq.includes("/cookies"), true);
    assert.equal(faq.includes("persdannye.ru"), false);
  });
});

describe("unpublished legal pages", () => {
  const pages: Array<{ file: string; marker: string }> = [
    { file: "app/privacy/page.tsx", marker: "Настоящая Политика обработки персональных данных" },
    { file: "app/consent/page.tsx", marker: "reportConsent.paragraphs" },
    { file: "app/consent-lead/page.tsx", marker: "leadConsent.paragraphs" },
    { file: "app/consent-marketing/page.tsx", marker: "marketingConsent.paragraphs" },
  ];

  it("serves a noindex LegalPending stub and keeps the document text in the repo", () => {
    assert.equal(legalPublication(), "pending");
    assert.deepEqual(unpublishedRobots(), { index: false, follow: false });
    assert.equal(unpublishedRobots(true), undefined);
    const pending = readFileSync(join(root, "components/legal/LegalPending.tsx"), "utf8");
    assert.equal(pending.includes("Текст не опубликован"), true);
    for (const page of pages) {
      const source = readFileSync(join(root, page.file), "utf8");
      const pendingAt = source.indexOf('legalPublication() === "pending"');
      const markerAt = source.indexOf(page.marker);
      assert.equal(pendingAt >= 0, true, page.file);
      assert.equal(source.includes("<LegalPending"), true, page.file);
      assert.equal(source.includes("unpublishedRobots()"), true, page.file);
      assert.equal(source.includes("notFound("), false, page.file);
      assert.equal(markerAt > pendingAt, true, page.file);
    }
    const hidden = sitePages().filter(
      (page) => page.path === "/privacy" || page.path.startsWith("/consent"),
    );
    assert.deepEqual(
      hidden.map((page) => page.path),
      ["/privacy", "/consent", "/consent-lead", "/consent-marketing"],
    );
    for (const page of hidden) assert.equal(page.index, false, page.path);
  });
});

describe("robots and sitemap", () => {
  it("allows every path, links the sitemap, and lists only indexable pages", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      assert.equal(siteBaseUrl(), SITE_URL_FALLBACK);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
    assert.equal(siteBaseUrl("https://example.test/"), "https://example.test");
    const base = "https://persdannye.vercel.app";
    const robots = robotsDocument(base);
    assert.deepEqual(robots.rules, { userAgent: "*", allow: "/" });
    assert.equal(robots.sitemap, `${base}/sitemap.xml`);
    const listed = sitePages().map((page) => page.path).sort();
    assert.deepEqual(appPagePaths().sort(), listed);
    const urls = sitemapEntries(base).map((item) => new URL(item.url).pathname);
    assert.deepEqual(urls.sort(), indexablePaths().sort());
    for (const page of sitePages()) {
      assert.equal(urls.includes(page.path), page.index, page.path);
    }
    assert.deepEqual(indexablePaths().sort(), ["/", "/check"]);
    const published = sitePages({
      show_site_legal: true,
      show_cookie_policy: false,
      show_terms: false,
    });
    assert.equal(published.find((page) => page.path === "/privacy")?.index, true);
    assert.equal(published.find((page) => page.path === "/offer")?.index, false);
  });
});

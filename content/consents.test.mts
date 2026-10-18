import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { reportConsent } from "./consents.ts";
import { flags } from "./flags.ts";
import { fillPlaceholders } from "./placeholders.ts";
import {
  UnresolvedMarketingConsentError,
  fillMarketingConsent,
  publishMarketingConsent,
  readMarketingConsentTemplate,
  renderMarketingConsentHtml,
} from "./marketing-consent.ts";

const TEMPLATE_SHA256 = "bea0f2b43fc39d5a9b78d4542f13c10de9d0cfaf435030cfa65c3e1a0da35fd1";

const fullRequisites: Record<string, string> = {
  operator_site: "https://example.test",
  operator_full_name: "ООО «Пример»",
  operator_inn: "7700000001",
  operator_address: "г. Пример, ул. Примерная, д. 1",
  privacy_contact_email: "privacy@example.test",
  processor_timeweb_legal: "ООО «Таймвэб»",
  processor_yandex360_legal: "ООО «Яндекс»",
};

const phrases = ["ч. 1 ст. 18", "ч. 1 ст. 15 152-ФЗ", "журнале согласий", "до его отзыва"] as const;

function templateBytes(): Buffer {
  return readFileSync(new URL("./consents/marketing-2026-10-11.md", import.meta.url));
}

describe("marketing consent canon", () => {
  it("matches the approved file hash", () => {
    const bytes = templateBytes();
    assert.equal(createHash("sha256").update(bytes).digest("hex"), TEMPLATE_SHA256);
    assert.equal(bytes.includes(13), false);
    assert.equal(bytes.subarray(-2).toString(), "\n\n");
    assert.equal(readMarketingConsentTemplate(), bytes.toString("utf8"));
  });

  it("has no three-year term in the file or the rendered page", () => {
    const file = templateBytes().toString("utf8");
    const published = publishMarketingConsent(file, fullRequisites);
    const html = renderMarketingConsentHtml(published);
    for (const banned of ["3 года", "3 лет"]) {
      assert.equal(file.includes(banned), false, banned);
      assert.equal(html.includes(banned), false, banned);
    }
  });

  it("renders the approved phrases and a privacy link", () => {
    const file = templateBytes().toString("utf8");
    const published = publishMarketingConsent(file, fullRequisites);
    const html = renderMarketingConsentHtml(published);
    for (const phrase of phrases) {
      assert.equal(file.includes(phrase), true, phrase);
      assert.equal(html.includes(phrase), true, phrase);
    }
    assert.equal(file.includes("{{operator_site}}/privacy"), true);
    assert.equal(html.includes('href="https://example.test/privacy"'), true);
    assert.equal(html.includes("<strong>рекламных</strong>"), true);
    assert.equal(html.includes("<ol"), true);
    const page = readFileSync(new URL("../app/consent-marketing/page.tsx", import.meta.url), "utf8");
    const article = readFileSync(
      new URL("../components/legal/MarketingConsentArticle.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(page.includes("MarketingConsentArticle"), true);
    assert.equal(article.includes("renderMarketingConsentHtml"), true);
  });

  it("leaves no placeholder when test requisites are complete", () => {
    const text = publishMarketingConsent(readMarketingConsentTemplate(), fullRequisites);
    assert.equal(text.includes("{{"), false);
    assert.equal(text.includes("}}"), false);
    assert.equal(fillMarketingConsent(readMarketingConsentTemplate(), fullRequisites).includes("{{"), false);
  });

  it("fails the guard when requisites are empty", () => {
    assert.throws(() => publishMarketingConsent(readMarketingConsentTemplate()), UnresolvedMarketingConsentError);
    const empty = Object.fromEntries(Object.keys(fullRequisites).map((key) => [key, ""]));
    assert.throws(() => publishMarketingConsent(readMarketingConsentTemplate(), empty), UnresolvedMarketingConsentError);
    assert.equal(fillPlaceholders("{{processor_timeweb_legal}}", false), "");
  });

  it("serves a noindex stub while show_site_legal is off", () => {
    assert.equal(flags.show_site_legal, false);
    const page = readFileSync(new URL("../app/consent-marketing/page.tsx", import.meta.url), "utf8");
    const pendingAt = page.indexOf("if (!flags.show_site_legal)");
    const publishAt = page.indexOf("publishMarketingConsent(readMarketingConsentTemplate())");
    assert.equal(pendingAt >= 0, true);
    assert.equal(publishAt > pendingAt, true);
    assert.equal(page.includes("<LegalPending"), true);
    assert.equal(page.includes("index: false"), true);
    assert.equal(page.includes("follow: false"), true);
    assert.equal(page.includes("legalPublication"), false);
    assert.equal(page.includes("unpublishedRobots"), false);
  });

  it("keeps the report consent limited to 36 months", () => {
    const text = [...reportConsent.paragraphs, ...reportConsent.points]
      .map((part) => fillPlaceholders(part, false))
      .join("\n");
    assert.equal(text.includes("не более 36 месяцев"), true);
    assert.equal(text.includes("3 года"), false);
    assert.equal(text.includes("3 лет"), false);
  });
});

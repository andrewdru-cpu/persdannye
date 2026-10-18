import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { MARKETING_CONSENT_TEXT_VERSION } from "../lib/consent.ts";
import { reportConsent } from "./consents.ts";
import { flags } from "./flags.ts";
import { fillPlaceholders, placeholders } from "./placeholders.ts";
import {
  MARKETING_CONSENT_FILE,
  UnresolvedMarketingConsentError,
  fillMarketingConsent,
  hashFilledMarketingConsent,
  publishMarketingConsent,
  readMarketingConsentTemplate,
  renderMarketingConsentHtml,
} from "./marketing-consent.ts";

const TEMPLATE_SHA256 = "32cba482c1f2b48ed195fe48f332bf0572f7df4bb34dbd5bc0924309950044e9";

const placeholderKeys = [
  "operator_full_name",
  "operator_inn",
  "operator_address",
  "operator_site",
  "processor_timeweb_legal",
  "processor_email_provider_legal",
  "privacy_contact_email",
  "policy_url",
] as const;

const fullRequisites: Record<string, string> = {
  operator_site: "https://example.test",
  operator_full_name: "ООО «Пример»",
  operator_inn: "7700000001",
  operator_address: "г. Пример, ул. Примерная, д. 1",
  privacy_contact_email: "privacy@example.test",
  processor_timeweb_legal: "ООО «Таймвэб»",
  processor_email_provider_legal: "ООО «Пример почты»",
  policy_url: "https://example.test/privacy",
};

const phrases = ["ч. 1 ст. 18", "ч. 1 ст. 15 152-ФЗ", "журнале согласий", "до его отзыва"] as const;

function templateBytes(): Buffer {
  return readFileSync(new URL(`./consents/${MARKETING_CONSENT_TEXT_VERSION}.md`, import.meta.url));
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

describe("marketing consent canon", () => {
  it("matches the approved file hash", () => {
    const bytes = templateBytes();
    assert.equal(createHash("sha256").update(bytes).digest("hex"), TEMPLATE_SHA256);
    assert.equal(bytes.includes(13), false);
    assert.equal(bytes.subarray(-6).toString("utf8"), "}}).\n\n");
    assert.equal(readMarketingConsentTemplate(), bytes.toString("utf8"));
  });

  it("uses the form version string as the canon filename", () => {
    assert.equal(MARKETING_CONSENT_FILE, `content/consents/${MARKETING_CONSENT_TEXT_VERSION}.md`);
    assert.equal(MARKETING_CONSENT_TEXT_VERSION, "2026-10-18-marketing");
    const forms = ["../components/landing/LeadForm.tsx", "../components/check/UrlChecker.tsx"];
    for (const form of forms) {
      const source = readFileSync(new URL(form, import.meta.url), "utf8");
      assert.equal(source.includes("MARKETING_CONSENT_TEXT_VERSION"), true, form);
      assert.equal(source.includes("marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION"), true, form);
      assert.equal(source.includes(`"${MARKETING_CONSENT_TEXT_VERSION}"`), false, form);
    }
  });

  it("has no retired marketing version in content, lib, or app", () => {
    const retired = ["2026-10-11", "marketing"].join("-");
    for (const root of ["content", "lib", "app"]) {
      for (const file of filesUnder(join(process.cwd(), root))) {
        assert.equal(file.includes(retired), false, file);
        assert.equal(readFileSync(file).includes(retired), false, file);
      }
    }
    const names = readdirSync(join(process.cwd(), "content/consents"));
    assert.equal(names.includes(`${retired}.md`), false);
  });

  it("hashes filled text separately and does not pin a production digest", () => {
    const filled = publishMarketingConsent(readMarketingConsentTemplate(), fullRequisites);
    const digest = hashFilledMarketingConsent(filled);
    assert.equal(digest, createHash("sha256").update(filled, "utf8").digest("hex"));
    assert.equal(digest === TEMPLATE_SHA256, false);
    assert.equal(filled.includes("{{"), false);
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
    assert.equal(file.includes("]({{policy_url}})"), true);
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

  it("contains exactly the eight approved placeholders", () => {
    const file = templateBytes().toString("utf8");
    const found = [...file.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((match) => match[1]);
    assert.deepEqual([...found].sort(), [...placeholderKeys].sort());
    assert.equal(new Set(found).size, placeholderKeys.length);
    assert.equal(file.includes("marketing_consent_term"), false);
    const source = readFileSync(new URL("./placeholders.ts", import.meta.url), "utf8");
    assert.equal(source.includes("marketing_consent_term"), false);
    assert.equal(placeholders.processor_email_provider_legal, "");
    assert.equal(placeholders.policy_url, "/privacy");
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

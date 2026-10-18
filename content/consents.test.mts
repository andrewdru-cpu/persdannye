import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { marketingConsent, reportConsent } from "./consents.ts";
import { flags } from "./flags.ts";
import { fillPlaceholders, placeholders } from "./placeholders.ts";
import { MARKETING_CONSENT_TEXT_VERSION } from "../lib/consent.ts";

const edition32Phrases = [
  "Оно действует до его отзыва.",
  "ч. 1 ст. 18 Федерального закона «О рекламе»",
  "ч. 1 ст. 15 152-ФЗ",
  "Timeweb Cloud",
  "хостинг",
  "«Яндекс 360»",
  "почта",
  "Факт согласия фиксируется в журнале согласий.",
  "раздел об отзыве, п. 11.4",
] as const;

const operatorMarkers = [
  "{{operator_site}}",
  "{{operator_full_name}}",
  "{{operator_inn}}",
  "{{operator_address}}",
  "{{privacy_contact_email}}",
  "{{processor_timeweb_legal}}",
  "{{processor_yandex360_legal}}",
  "{{policy_url}}",
] as const;

function filledMarketingConsent(todos: boolean): string {
  return [...marketingConsent.paragraphs, ...marketingConsent.points]
    .map((part) => fillPlaceholders(part, todos))
    .join("\n");
}

describe("marketing consent term", () => {
  it("lasts until withdrawal after placeholders are filled", () => {
    for (const todos of [false, true]) {
      const text = filledMarketingConsent(todos);
      assert.equal(text.includes("не более"), false, `todos=${todos}`);
      assert.equal(text.includes("3 года"), false, `todos=${todos}`);
      assert.equal(text.includes("marketing_consent_term"), false, `todos=${todos}`);
      assert.equal(text.includes("Оно действует до его отзыва."), true, `todos=${todos}`);
    }
    assert.equal("marketing_consent_term" in placeholders, false);
    const source = JSON.stringify(marketingConsent);
    assert.equal(source.includes("marketing_consent_term"), false);
    assert.equal(source.includes("3 года"), false);
    assert.equal(source.includes("не более"), false);
    assert.equal(MARKETING_CONSENT_TEXT_VERSION, "2026-10-11-marketing");
  });

  it("matches edition 3.2 after placeholders are filled", () => {
    const source = JSON.stringify(marketingConsent);
    for (const phrase of edition32Phrases) {
      assert.equal(source.includes(phrase), true, phrase);
    }
    for (const marker of operatorMarkers) {
      assert.equal(source.includes(marker), true, marker);
    }
    for (const todos of [false, true]) {
      const text = filledMarketingConsent(todos);
      for (const phrase of edition32Phrases) {
        assert.equal(text.includes(phrase), true, `${phrase} todos=${todos}`);
      }
      assert.equal(text.includes("/privacy"), true, `todos=${todos}`);
      assert.equal(text.includes("не более"), false, `todos=${todos}`);
      assert.equal(text.includes("3 года"), false, `todos=${todos}`);
      assert.equal(text.includes("marketing_consent_term"), false, `todos=${todos}`);
    }
  });

  it("serves a noindex stub while show_site_legal is off", () => {
    assert.equal(flags.show_site_legal, false);
    const page = readFileSync(new URL("../app/consent-marketing/page.tsx", import.meta.url), "utf8");
    const pendingAt = page.indexOf("if (!flags.show_site_legal)");
    const documentAt = page.indexOf("marketingConsent.paragraphs");
    assert.equal(pendingAt >= 0, true);
    assert.equal(documentAt > pendingAt, true);
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
    assert.equal(text.includes("marketing_consent_term"), false);
    assert.equal(text.includes("3 года"), false);
    assert.equal(JSON.stringify(reportConsent).includes("{{retention_months_goal1}}"), true);
  });
});

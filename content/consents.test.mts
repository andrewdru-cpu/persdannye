import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { marketingConsent, reportConsent } from "./consents.ts";
import { fillPlaceholders, placeholders } from "./placeholders.ts";
import { MARKETING_CONSENT_TEXT_VERSION } from "../lib/consent.ts";

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

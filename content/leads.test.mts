import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  CONSENT_TEXT_VERSION,
  MARKETING_CONSENT_TEXT_VERSION,
  marketingConsentForParser,
} from "../lib/consent.ts";
import { leadBodySchema } from "../lib/lead-schema.ts";

const validLead = {
  name: "Анна",
  email: "anna@example.com",
  phone: "+79990001122",
  url: "https://example.com",
  checkId: "11111111-1111-1111-1111-111111111111",
  message: "Нужен разбор",
  consent: true,
  consent_text_version: "2026-10-11-lead",
  marketing_consent: false,
  source: "landing",
};

describe("lead request limits", () => {
  it("keeps the marketing consent text version within 32 characters", () => {
    assert.equal(MARKETING_CONSENT_TEXT_VERSION.length <= 32, true);
    assert.equal(MARKETING_CONSENT_TEXT_VERSION.length > 0, true);
    assert.notEqual(MARKETING_CONSENT_TEXT_VERSION, CONSENT_TEXT_VERSION);
    const on = marketingConsentForParser(true);
    assert.equal(on.marketing_consent, true);
    assert.equal(on.marketing_consent_text_version, MARKETING_CONSENT_TEXT_VERSION);
    assert.equal(on.marketing_consent_text_version!.length <= 32, true);
    assert.equal("marketing_consent_at" in on, false);
    const off = marketingConsentForParser(false);
    assert.deepEqual(off, { marketing_consent: false });
    assert.equal("marketing_consent_text_version" in off, false);
    assert.equal("marketing_consent_at" in off, false);
  });

  it("rejects oversized strings on every lead field", () => {
    assert.equal(leadBodySchema.safeParse(validLead).success, true);
    assert.equal(leadBodySchema.safeParse({ ...validLead, email: "" }).success, true);
    const tooLong: Record<string, string> = {
      name: "я".repeat(121),
      email: `${"a".repeat(190)}@example.com`,
      phone: "1".repeat(41),
      url: `https://example.com/${"a".repeat(2048)}`,
      checkId: "x".repeat(65),
      message: "я".repeat(4001),
      consent_text_version: "v".repeat(65),
      marketing_consent_text_version: "v".repeat(33),
      source: "s".repeat(65),
    };
    for (const [field, value] of Object.entries(tooLong)) {
      const parsed = leadBodySchema.safeParse({ ...validLead, [field]: value });
      assert.equal(parsed.success, false, field);
    }
    const versionOk = "v".repeat(32);
    assert.equal(versionOk.length, 32);
    assert.equal(
      leadBodySchema.safeParse({
        ...validLead,
        marketing_consent: true,
        marketing_consent_text_version: versionOk,
      }).success,
      true,
    );
  });

  it("sends explicit marketing_consent false and a generic server error", () => {
    const route = readFileSync(new URL("../app/api/leads/route.ts", import.meta.url), "utf8");
    const form = readFileSync(new URL("../components/landing/LeadForm.tsx", import.meta.url), "utf8");
    const routeWithoutNamedVersions = route.replaceAll("LEAD_CONSENT_TEXT_VERSION", "");
    assert.equal(route.includes("marketingConsentForParser"), true);
    assert.equal(routeWithoutNamedVersions.includes("CONSENT_TEXT_VERSION"), false);
    assert.equal(route.includes("e.message"), false);
    assert.equal(route.includes("err.message"), false);
    assert.equal(route.includes("marketing_consent_at"), false);
    assert.match(route, /"Ошибка сервера"/);
    const formWithoutNamedVersions = form
      .replaceAll("MARKETING_CONSENT_TEXT_VERSION", "")
      .replaceAll("LEAD_CONSENT_TEXT_VERSION", "");
    assert.equal(form.includes("MARKETING_CONSENT_TEXT_VERSION"), true);
    assert.equal(formWithoutNamedVersions.includes("CONSENT_TEXT_VERSION"), false);
    assert.match(form, /marketing_consent: marketingConsent && marketingOptIn \? true : false/);
    assert.equal(form.includes("marketing_consent_at"), false);
  });
});

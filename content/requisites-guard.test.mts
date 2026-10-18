import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { flags } from "./flags.ts";
import { footerParagraphs } from "./blocks.ts";
import { company } from "../lib/company.ts";
import { ogrnLabel, operatorDisclaimer, requisiteIdLine, visiblePhone, visibleRequisite } from "../lib/requisite-lines.ts";
import {
  assertPublishedRequisites,
  assertRequisiteFlags,
  assertTermsAndCookieFlags,
  emptyRequisiteFields,
  type PublishedRequisites,
  type RequisiteIdentity,
} from "../lib/requisites-guard.ts";

const filled: RequisiteIdentity = {
  legalName: "ООО Пример",
  inn: "1098765432",
  ogrn: "1234567890123",
  address: "г. Пример, ул. Примерная, д. 1",
};

function source(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

describe("requisites guard", () => {
  it("allows the current flags and blocks publication while identity fields are blank", () => {
    assert.equal(flags.show_requisites, false);
    assert.equal(flags.show_terms, false);
    assert.doesNotThrow(() => assertRequisiteFlags(flags, company));
    assert.deepEqual(emptyRequisiteFields(filled), []);
    assert.doesNotThrow(() => assertRequisiteFlags({ show_requisites: true, show_terms: true }, filled));
    assert.doesNotThrow(() =>
      assertRequisiteFlags({ show_requisites: false, show_terms: false }, {
        legalName: "",
        inn: "",
        ogrn: "",
        address: "",
      }),
    );
    for (const field of ["legalName", "inn", "ogrn", "address"] as const) {
      const blank = { ...filled, [field]: "  " };
      assert.throws(
        () => assertRequisiteFlags({ show_requisites: true, show_terms: false }, blank),
        /show_requisites/,
      );
      assert.throws(
        () => assertRequisiteFlags({ show_requisites: false, show_terms: true }, blank),
        /show_terms/,
      );
    }
    const config = source("next.config.ts");
    assert.equal(config.includes("assertRequisiteFlags"), true);
    assert.equal(config.includes("assertPublishedRequisites"), true);
    assert.equal(config.includes("assertTermsAndCookieFlags"), true);
    assert.doesNotThrow(() =>
      assertTermsAndCookieFlags(flags, {
        legalName: company.legalName,
        privacy_contact_email: company.privacy_contact_email,
      }),
    );
    assert.throws(
      () =>
        assertTermsAndCookieFlags(
          { show_terms: true, show_cookie_policy: false, show_site_legal: false },
          { legalName: filled.legalName, privacy_contact_email: "a@b.c" },
        ),
      /show_terms/,
    );
    assert.doesNotThrow(() =>
      assertTermsAndCookieFlags(
        { show_terms: true, show_cookie_policy: false, show_site_legal: true },
        { legalName: filled.legalName, privacy_contact_email: "a@b.c" },
      ),
    );
    assert.throws(
      () =>
        assertTermsAndCookieFlags(
          { show_terms: false, show_cookie_policy: true, show_site_legal: false },
          { legalName: filled.legalName, privacy_contact_email: "a@b.c" },
        ),
      /show_site_legal/,
    );
    assert.throws(
      () =>
        assertTermsAndCookieFlags(
          { show_terms: false, show_cookie_policy: true, show_site_legal: true },
          { legalName: "  ", privacy_contact_email: "a@b.c" },
        ),
      /legalName/,
    );
    assert.throws(
      () =>
        assertTermsAndCookieFlags(
          { show_terms: false, show_cookie_policy: true, show_site_legal: true },
          { legalName: filled.legalName, privacy_contact_email: "" },
        ),
      /privacy_contact_email/,
    );
    assert.doesNotThrow(() =>
      assertTermsAndCookieFlags(
        { show_terms: true, show_cookie_policy: true, show_site_legal: true },
        { legalName: filled.legalName, privacy_contact_email: "a@b.c" },
      ),
    );
  });

  it("omits empty inn, ogrn, and tel labels", () => {
    assert.equal(requisiteIdLine("", ""), null);
    assert.equal(requisiteIdLine("  ", "  "), null);
    assert.equal(requisiteIdLine("1098765432", ""), "ИНН 1098765432");
    assert.equal(requisiteIdLine("", "1234567890123"), "ОГРН 1234567890123");
    assert.equal(requisiteIdLine("1098765432", "1234567890123"), "ИНН 1098765432, ОГРН 1234567890123");
    assert.equal(company.legalForm, "");
    assert.equal(ogrnLabel(""), "ОГРН");
    assert.equal(ogrnLabel("ООО"), "ОГРН");
    assert.equal(ogrnLabel("ИП"), "ОГРНИП");
    assert.equal(requisiteIdLine("1098765432", "1234567890123", ""), "ИНН 1098765432, ОГРН 1234567890123");
    assert.equal(requisiteIdLine("1098765432", "1234567890123", "ООО"), "ИНН 1098765432, ОГРН 1234567890123");
    assert.equal(requisiteIdLine("1098765432", "304770000000000", "ИП"), "ИНН 1098765432, ОГРНИП 304770000000000");
    assert.equal(visiblePhone("", "tel:"), null);
    assert.equal(visiblePhone("  ", "tel:+79001112233"), null);
    assert.deepEqual(visiblePhone("+7 900 111-22-33", "tel:"), { text: "+7 900 111-22-33", href: null });
    assert.deepEqual(visiblePhone("+7 900 111-22-33", ""), { text: "+7 900 111-22-33", href: null });
    assert.deepEqual(visiblePhone("+7 900 111-22-33", "tel:+79001112233"), {
      text: "+7 900 111-22-33",
      href: "tel:+79001112233",
    });
    assert.equal(visibleRequisite("  "), null);
    assert.equal(operatorDisclaimer("", ""), null);
    assert.equal(operatorDisclaimer("ООО Пример", ""), "Оператор сайта: ООО Пример.");
    assert.equal(operatorDisclaimer("", "1098765432"), "Оператор сайта: ИНН 1098765432.");
    assert.equal(operatorDisclaimer("ООО Пример", "").includes("ИНН "), false);
    assert.equal(company.legalName, "");
    assert.equal(company.inn, "");
    assert.equal(company.ogrn, "");
    assert.equal(company.address, "");
    assert.equal(company.phone, "");
    assert.equal(company.phoneHref, "");
    const hidden = footerParagraphs(false, true).find((line) => line.startsWith("Оператор сайта"));
    assert.equal(hidden, undefined);
    const published: PublishedRequisites = {
      legalName: "ООО Пример",
      inn: "1098765439",
      ogrn: "1234567890127",
      address: "г. Пример, ул. Примерная, д. 1",
      phone: "+7 900 111-22-33",
      phoneHref: "tel:+79001112233",
      legalForm: "",
    };
    assert.doesNotThrow(() => assertPublishedRequisites(false, company));
    assert.throws(() => assertPublishedRequisites(true, company), /Реквизиты пустые/);
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, inn: "0000000000" }),
      /Тестовый ИНН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, inn: "7700000000" }),
      /Тестовый ИНН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, ogrn: "0000000000000" }),
      /Тестовый ОГРН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, address: "г. Пример, {{address}}" }),
      /Плейсхолдер в реквизитах/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, inn: "1098765432" }),
      /Некорректный ИНН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, ogrn: "1234567890123" }),
      /Некорректный ОГРН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...published, legalForm: "ИП" }),
      /Некорректный ИНН/,
    );
    assert.equal(
      assertPublishedRequisites(true, {
        ...published,
        legalForm: "ИП",
        inn: "109876543252",
        ogrn: "304770000000008",
      }),
      undefined,
    );
    assert.equal(assertPublishedRequisites(true, published), undefined);
    assert.equal(
      operatorDisclaimer(published.legalName, published.inn),
      "Оператор сайта: ООО Пример, ИНН 1098765439.",
    );
    const footer = source("components/layout/Footer.tsx");
    assert.equal(footer.includes("requisiteIdLine("), true);
    assert.equal(footer.includes("visiblePhone("), true);
    assert.equal(footer.includes("ИНН {company.inn}"), false);
    assert.equal(footer.includes("ОГРН {company.ogrn}"), false);
    assert.equal(footer.includes("href={company.phoneHref}"), false);
    const privacy = source("app/privacy/page.tsx");
    assert.equal(privacy.includes("Тел.: {company.phone}"), false);
    assert.equal(privacy.includes("visibleRequisite(company.phone)"), true);
  });
});

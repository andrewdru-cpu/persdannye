import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { flags } from "./flags.ts";
import { footerParagraphs } from "./blocks.ts";
import CookiesPage from "../app/cookies/page.tsx";
import PrivacyPage from "../app/privacy/page.tsx";
import TermsPage from "../app/terms/page.tsx";
import { company } from "../lib/company.ts";
import { ogrnLabel, operatorDisclaimer, requisiteIdLine, visiblePhone, visibleRequisite } from "../lib/requisite-lines.ts";
import {
  assertPublishedRequisites,
  assertRequisiteFlags,
  assertTermsAndCookieFlags,
  emptyRequisiteFields,
  entrepreneurRequisites,
  validInn10,
  validKpp,
  validOgrn13,
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
    assert.equal(company.kpp, "");
    assert.equal(company.address, "");
    assert.equal(company.phone, "");
    assert.equal(company.phoneHref, "");
    assert.equal(entrepreneurRequisites(company.legalForm), false);
    const hidden = footerParagraphs(false, true).find((line) => line.startsWith("Оператор сайта"));
    assert.equal(hidden, undefined);
    assert.equal(
      operatorDisclaimer("ООО Пример", "1098765439"),
      "Оператор сайта: ООО Пример, ИНН 1098765439.",
    );
    const footer = source("components/layout/Footer.tsx");
    assert.equal(footer.includes("requisiteIdLine("), true);
    assert.equal(footer.includes("visiblePhone("), true);
    assert.equal(footer.includes("assertPublishedRequisites("), true);
    assert.equal(footer.includes("ИНН {company.inn}"), false);
    assert.equal(footer.includes("ОГРН {company.ogrn}"), false);
    assert.equal(footer.includes("href={company.phoneHref}"), false);
    const privacy = source("app/privacy/page.tsx");
    assert.equal(privacy.includes("Тел.: {company.phone}"), false);
    assert.equal(privacy.includes("assertPublishedRequisites(company)"), true);
    assert.equal(source("app/terms/page.tsx").includes("assertPublishedRequisites(company)"), true);
    assert.equal(source("app/cookies/page.tsx").includes("assertPublishedRequisites(company)"), true);
  });
});

const legalEntity: PublishedRequisites = {
  legalName: "ООО Пример",
  inn: "1098765439",
  ogrn: "1234567890127",
  kpp: "773601001",
  address: "г. Пример, ул. Примерная, д. 1",
  phone: "+7 900 111-22-33",
  phoneHref: "tel:+79001112233",
  legalForm: "",
};

const entrepreneur: PublishedRequisites = {
  legalName: "ИП Пример Пример Пример",
  inn: "109876543252",
  ogrn: "304770000000008",
  address: "г. Пример, ул. Примерная, д. 1",
  phone: "+7 900 111-22-33",
  phoneHref: "tel:+79001112233",
  legalForm: "ИП",
};

const storedPlaceholders: PublishedRequisites = {
  legalName: "ООО «ПерсДанные»",
  inn: "7700000000",
  ogrn: "1207700000000",
  kpp: "770001001",
  address: "123112, г. Москва, Пресненская наб., д. 12, этаж 1, офис 1",
  phone: "+7 (495) 000-00-00",
  phoneHref: "tel:+74950000000",
  legalForm: "",
};

function withBadChecksum(value: string): string {
  const last = Number(value[value.length - 1]);
  return `${value.slice(0, -1)}${last === 9 ? 0 : last + 1}`;
}

describe("published requisites", () => {
  it("checks OGRN and INN-10 checksums, KPP, and rejects a 12-digit INN while IP is off", () => {
    assert.equal(validInn10(legalEntity.inn ?? ""), true);
    assert.equal(validOgrn13(legalEntity.ogrn ?? ""), true);
    assert.equal(validKpp("773601001"), true);
    assert.equal(validKpp("77360100"), false);
    assert.equal(validKpp("000000000"), false);
    assert.equal(validKpp("7736AB001"), true);
    assert.equal(entrepreneurRequisites(""), false);
    assert.equal(entrepreneurRequisites("ООО"), false);
    assert.equal(entrepreneurRequisites("ИП"), true);
    assert.equal(assertPublishedRequisites(legalEntity), true);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "12345678" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: withBadChecksum(legalEntity.inn ?? "") }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: withBadChecksum(legalEntity.ogrn ?? "") }), false);
    assert.equal(
      assertPublishedRequisites({ ...legalEntity, inn: "109876543252", legalForm: "" }),
      false,
    );
    assert.equal(
      assertPublishedRequisites({ ...legalEntity, inn: "109876543252", legalForm: "ООО" }),
      false,
    );
    assert.equal(assertPublishedRequisites({ ...entrepreneur, legalForm: "" }), false);
    assert.equal(assertPublishedRequisites(entrepreneur), true);
    assert.equal(assertPublishedRequisites({ ...entrepreneur, inn: withBadChecksum(entrepreneur.inn ?? "") }), false);
    assert.equal(assertPublishedRequisites({ ...entrepreneur, ogrn: withBadChecksum(entrepreneur.ogrn ?? "") }), false);
  });

  it("rejects placeholders", () => {
    assert.equal(assertPublishedRequisites(company), false);
    assert.equal(assertPublishedRequisites(null), false);
    assert.equal(assertPublishedRequisites(storedPlaceholders), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, legalName: "  " }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, legalName: "ООО {{legalName}}" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: "0000000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: "7700000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: "0000000000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: "1207700000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, address: storedPlaceholders.address }), false);
    assert.equal(
      assertPublishedRequisites({
        ...legalEntity,
        address: "г. Москва, Пресненская набережная, д. 12",
      }),
      false,
    );
    assert.equal(assertPublishedRequisites({ ...legalEntity, phone: "+7 (495) 000-00-00" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, phoneHref: "tel:+74950000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, phoneHref: "+79001112233" }), false);
  });

  it("does not render requisite blocks from placeholder company data", () => {
    const saved = {
      terms: flags.show_terms,
      cookies: flags.show_cookie_policy,
      requisites: flags.show_requisites,
    };
    flags.show_terms = true;
    flags.show_cookie_policy = true;
    flags.show_requisites = true;
    try {
      assert.equal(assertPublishedRequisites(company), false);
      const privacy = renderToStaticMarkup(PrivacyPage());
      const terms = renderToStaticMarkup(TermsPage());
      const cookies = renderToStaticMarkup(CookiesPage());
      for (const [name, html] of [
        ["privacy", privacy],
        ["terms", terms],
        ["cookies", cookies],
      ] as const) {
        assert.equal(html.includes("Пресненская"), false, name);
        assert.equal(html.includes("7700000000"), false, name);
        assert.equal(html.includes("1207700000000"), false);
        assert.equal(html.includes("000-00-00"), false, name);
        assert.equal(html.includes("ООО «ПерсДанные»"), false, name);
        assert.equal(html.includes("ИНН"), false, name);
        assert.equal(html.includes("ОГРН"), false, name);
        assert.equal(html.includes("КПП"), false, name);
        assert.equal(html.includes("адрес:"), false, name);
        assert.equal(html.includes("Тел.:"), false, name);
      }
      assert.match(privacy, /Редакция от 21\.09\.2026/);
      assert.match(privacy, /осуществляемой оператором \(далее — Оператор\)/);
      assert.equal(terms.includes("9. Реквизиты"), false);
      assert.match(terms, /Пользовательское соглашение/);
      assert.match(cookies, /Политика cookie/);
    } finally {
      flags.show_terms = saved.terms;
      flags.show_cookie_policy = saved.cookies;
      flags.show_requisites = saved.requisites;
    }
  });
});

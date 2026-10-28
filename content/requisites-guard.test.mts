import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import CookiesPage from "../app/cookies/page.tsx";
import LeadConsentPage from "../app/consent-lead/page.tsx";
import MarketingConsentPage from "../app/consent-marketing/page.tsx";
import ReportConsentPage from "../app/consent/page.tsx";
import PrivacyPage from "../app/privacy/page.tsx";
import TermsPage from "../app/terms/page.tsx";
import { Footer } from "../components/layout/Footer.tsx";
import { leadConsent, marketingConsent, reportConsent } from "./consents.ts";
import { flags } from "./flags.ts";
import { company } from "../lib/company.ts";
import {
  allowEntrepreneurRequisites,
  assertPublishedRequisites,
  ogrnCaption,
  type PublishedRequisites,
} from "../lib/requisites-guard.ts";

/** Синтетика: контрольные цифры посчитаны отдельно от стража. */
const legalEntity: PublishedRequisites = {
  legalName: "ООО Пример",
  inn: "1098765439",
  kpp: "123456789",
  ogrn: "1234567890127",
  address: "г. Пример, ул. Примерная, д. 1",
  phone: "+7 900 111-22-33",
  phoneHref: "tel:+79001112233",
};

const entrepreneur: PublishedRequisites = {
  ...legalEntity,
  legalName: "ИП Пример Пример Пример",
  inn: "109876543252",
  kpp: "",
  ogrn: "123456789012343",
};

const storedPlaceholders: PublishedRequisites = {
  legalName: "ООО «ПерсДанные»",
  inn: "7700000000",
  kpp: "000000000",
  ogrn: "1207700000000",
  address: "123112, г. Москва, Пресненская наб., д. 12, этаж 1, офис 1",
  phone: "+7 (495) 000-00-00",
  phoneHref: "tel:+74950000000",
};

function withBadChecksum(value: string): string {
  const last = Number(value[value.length - 1]);
  return `${value.slice(0, -1)}${last === 9 ? 0 : last + 1}`;
}

function isPublished(
  requisites: Parameters<typeof assertPublishedRequisites>[0],
  allowEntrepreneur?: boolean,
): boolean {
  return assertPublishedRequisites(requisites, allowEntrepreneur) !== null;
}

describe("requisites guard", () => {
  it("accepts a valid 13-digit OGRN and rejects a wrong checksum", () => {
    assert.equal(legalEntity.ogrn.length, 13);
    assert.equal(isPublished(legalEntity), true);
    assert.equal(
      isPublished({ ...legalEntity, ogrn: withBadChecksum(legalEntity.ogrn) }),
      false,
    );
    assert.equal(isPublished({ ...legalEntity, ogrn: "123456789012" }), false);
  });

  it("accepts a valid 10-digit INN and rejects a wrong checksum", () => {
    assert.equal(legalEntity.inn.length, 10);
    assert.equal(isPublished(legalEntity), true);
    assert.equal(
      isPublished({ ...legalEntity, inn: withBadChecksum(legalEntity.inn) }),
      false,
    );
    assert.equal(isPublished({ ...legalEntity, inn: "109876543" }), false);
  });

  it("requires a 9-character KPP for an LLC", () => {
    assert.equal(legalEntity.kpp?.length, 9);
    assert.equal(isPublished(legalEntity), true);
    assert.equal(isPublished({ ...legalEntity, kpp: "12345678" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "1234567890" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "000000000" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "1234 5678" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "1234AB789" }), true);
    assert.equal(isPublished({ ...legalEntity, kpp: "12A456789" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "12345678A" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "1234ab789" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "1234АБ789" }), false);
  });

  it("returns the trimmed values", () => {
    assert.deepEqual(
      assertPublishedRequisites({
        ...legalEntity,
        legalName: "  ООО Пример  ",
        inn: " 1098765439 ",
        kpp: " 123456789 ",
        ogrn: " 1234567890127 ",
        address: "  г. Пример, ул. Примерная, д. 1  ",
        phone: "  +7 900 111-22-33  ",
        phoneHref: "  tel:+79001112233  ",
      }),
      {
        legalName: "ООО Пример",
        inn: "1098765439",
        kpp: "123456789",
        ogrn: "1234567890127",
        address: "г. Пример, ул. Примерная, д. 1",
        phone: "+7 900 111-22-33",
        phoneHref: "tel:+79001112233",
      },
    );
  });

  it("labels OGRNIP only when the entrepreneur branch is on", () => {
    assert.equal(ogrnCaption("123456789012343"), "ОГРН");
    assert.equal(ogrnCaption("123456789012343", false), "ОГРН");
    assert.equal(ogrnCaption("123456789012343", true), "ОГРНИП");
    assert.equal(ogrnCaption(legalEntity.ogrn, true), "ОГРН");
  });

  it("rejects a 12-digit INN while the entrepreneur branch is off", () => {
    assert.equal(allowEntrepreneurRequisites, false);
    assert.equal(entrepreneur.inn.length, 12);
    assert.equal(isPublished(entrepreneur), false);
    assert.equal(isPublished({ ...legalEntity, inn: entrepreneur.inn }), false);
    assert.equal(isPublished({ ...legalEntity, ogrn: entrepreneur.ogrn }), false);
  });

  it("accepts the entrepreneur branch only when the flag is on", () => {
    assert.equal(isPublished(entrepreneur, false), false);
    assert.equal(isPublished(entrepreneur, true), true);
    assert.equal(
      isPublished({ ...entrepreneur, inn: withBadChecksum(entrepreneur.inn) }, true),
      false,
    );
    assert.equal(
      isPublished({ ...entrepreneur, ogrn: withBadChecksum(entrepreneur.ogrn) }, true),
      false,
    );
    assert.equal(isPublished(legalEntity, true), true);
    assert.equal(
      isPublished({ ...legalEntity, inn: entrepreneur.inn, ogrn: entrepreneur.ogrn }, false),
      false,
    );
  });

  it("rejects placeholders", () => {
    assert.equal(company.legalName, "");
    assert.equal(company.inn, "");
    assert.equal(company.kpp, "");
    assert.equal(company.ogrn, "");
    assert.equal(company.address, "");
    assert.equal(company.phone, "");
    assert.equal(company.phoneHref, "");
    assert.equal(isPublished(company), false);
    assert.equal(isPublished(null), false);
    assert.equal(isPublished(storedPlaceholders), false);
    assert.equal(isPublished({ ...legalEntity, legalName: "  " }), false);
    assert.equal(isPublished({ ...legalEntity, legalName: "ООО {{legalName}}" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "{{kpp}}123" }), false);
    assert.equal(isPublished({ ...legalEntity, inn: "0000000000" }), false);
    assert.equal(isPublished({ ...legalEntity, inn: "7700000000" }), false);
    assert.equal(isPublished({ ...legalEntity, ogrn: "0000000000000" }), false);
    assert.equal(isPublished({ ...legalEntity, ogrn: "1207700000000" }), false);
    assert.equal(isPublished({ ...legalEntity, address: "" }), false);
    assert.equal(isPublished({ ...legalEntity, address: storedPlaceholders.address }), false);
    assert.equal(
      isPublished({
        ...legalEntity,
        address: "г. Москва, Пресненская набережная, д. 12",
      }),
      false,
    );
    assert.equal(isPublished({ ...legalEntity, phone: "+7 (495) 000-00-00" }), false);
    assert.equal(isPublished({ ...legalEntity, phoneHref: "tel:+74950000000" }), false);
  });
});

describe("privacy page", () => {
  it("does not render the requisites block when KPP is missing", async () => {
    assert.equal(company.kpp, "");
    assert.equal(isPublished({ ...legalEntity, kpp: "" }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: null }), false);
    assert.equal(isPublished({ ...legalEntity, kpp: "   " }), false);
    assert.equal(isPublished(company), false);
    const html = renderToStaticMarkup(await PrivacyPage());
    assert.equal(html.includes("КПП"), false);
    assert.equal(html.includes("Пресненская"), false);
    assert.equal(html.includes("7700000000"), false);
    assert.equal(html.includes("1207700000000"), false);
    assert.equal(html.includes("000-00-00"), false);
    assert.equal(html.includes("ООО «ПерсДанные»"), false);
    assert.equal(html.includes("ИНН"), false);
    assert.equal(html.includes("ОГРН"), false);
    assert.equal(html.includes("адрес:"), false);
    assert.equal(html.includes("оператор:"), false);
    assert.equal(html.includes("Тел.:"), false);
    assert.match(html, /Политика обработки персональных данных/);
    assert.match(html, /Редакция от 21\.09\.2026/);
    assert.match(html, /осуществляемой оператором \(далее — Оператор\)/);
    assert.match(html, /persdannye\.ru/);
    assert.match(html, /пн–пт, 10:00–19:00 \(МСК\)/);
    assert.equal(html.includes("ОГРНИП"), false);
  });
});

describe("consent pages", () => {
  it("does not render empty operator fields while requisites are unpublished", async () => {
    const raw = JSON.stringify({ reportConsent, leadConsent, marketingConsent });
    assert.equal(raw.includes("ОГРН/ОГРНИП"), false);
    assert.equal(raw.includes("ОГРНИП"), false);
    for (const page of [await ReportConsentPage(), await LeadConsentPage(), await MarketingConsentPage()]) {
      const html = renderToStaticMarkup(page);
      assert.equal(html.includes("ИНН ,"), false, html);
      assert.equal(html.includes("()"), false, html);
      assert.equal(html.includes("адрес: )"), false, html);
      assert.equal(html.includes("ОГРНИП"), false, html);
      assert.match(html, /оператору \(далее — Оператор\)/);
    }
  });
});

describe("flagged company fields", () => {
  it("keeps footer, terms, and cookies free of requisites when the guard fails", () => {
    const saved = {
      requisites: flags.show_requisites,
      terms: flags.show_terms,
      cookies: flags.show_cookie_policy,
    };
    flags.show_requisites = true;
    flags.show_terms = true;
    flags.show_cookie_policy = true;
    try {
      const footer = renderToStaticMarkup(Footer());
      const terms = renderToStaticMarkup(TermsPage());
      const cookies = renderToStaticMarkup(CookiesPage());
      assert.equal(footer.includes("ИНН "), false);
      assert.equal(footer.includes("ОГРН "), false);
      assert.match(footer, /Реквизиты не опубликованы/);
      assert.match(footer, /ПерсДанные/);
      assert.equal(terms.includes("ИНН "), false);
      assert.equal(terms.includes("ОГРН "), false);
      assert.match(terms, /публичной офертой и регулирует/);
      assert.equal(cookies.includes("тел."), false);
      assert.equal(cookies.includes("ИНН"), false);
    } finally {
      flags.show_requisites = saved.requisites;
      flags.show_terms = saved.terms;
      flags.show_cookie_policy = saved.cookies;
    }
  });
});

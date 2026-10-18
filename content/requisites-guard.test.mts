import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "../app/privacy/page.tsx";
import { company } from "../lib/company.ts";
import {
  allowEntrepreneurRequisites,
  assertPublishedRequisites,
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

describe("requisites guard", () => {
  it("accepts a valid 13-digit OGRN and rejects a wrong checksum", () => {
    assert.equal(legalEntity.ogrn.length, 13);
    assert.equal(assertPublishedRequisites(legalEntity), true);
    assert.equal(
      assertPublishedRequisites({ ...legalEntity, ogrn: withBadChecksum(legalEntity.ogrn) }),
      false,
    );
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: "123456789012" }), false);
  });

  it("accepts a valid 10-digit INN and rejects a wrong checksum", () => {
    assert.equal(legalEntity.inn.length, 10);
    assert.equal(assertPublishedRequisites(legalEntity), true);
    assert.equal(
      assertPublishedRequisites({ ...legalEntity, inn: withBadChecksum(legalEntity.inn) }),
      false,
    );
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: "109876543" }), false);
  });

  it("requires a 9-character KPP for an LLC", () => {
    assert.equal(legalEntity.kpp?.length, 9);
    assert.equal(assertPublishedRequisites(legalEntity), true);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "12345678" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "1234567890" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "000000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "1234 5678" }), false);
  });

  it("rejects a 12-digit INN while the entrepreneur branch is off", () => {
    assert.equal(allowEntrepreneurRequisites, false);
    assert.equal(entrepreneur.inn.length, 12);
    assert.equal(assertPublishedRequisites(entrepreneur), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: entrepreneur.inn }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: entrepreneur.ogrn }), false);
  });

  it("accepts the entrepreneur branch only when the flag is on", () => {
    assert.equal(assertPublishedRequisites(entrepreneur, false), false);
    assert.equal(assertPublishedRequisites(entrepreneur, true), true);
    assert.equal(
      assertPublishedRequisites({ ...entrepreneur, inn: withBadChecksum(entrepreneur.inn) }, true),
      false,
    );
    assert.equal(
      assertPublishedRequisites({ ...entrepreneur, ogrn: withBadChecksum(entrepreneur.ogrn) }, true),
      false,
    );
    assert.equal(assertPublishedRequisites(legalEntity, true), true);
    assert.equal(
      assertPublishedRequisites({ ...legalEntity, inn: entrepreneur.inn, ogrn: entrepreneur.ogrn }, false),
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
    assert.equal(assertPublishedRequisites(company), false);
    assert.equal(assertPublishedRequisites(null), false);
    assert.equal(assertPublishedRequisites(storedPlaceholders), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, legalName: "  " }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, legalName: "ООО {{legalName}}" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "{{kpp}}123" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: "0000000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, inn: "7700000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: "0000000000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, ogrn: "1207700000000" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, address: "" }), false);
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
  });
});

describe("privacy page", () => {
  it("does not render the requisites block when KPP is missing", async () => {
    assert.equal(company.kpp, "");
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "" }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: null }), false);
    assert.equal(assertPublishedRequisites({ ...legalEntity, kpp: "   " }), false);
    assert.equal(assertPublishedRequisites(company), false);
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
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { company } from "../lib/company.ts";
import { assertPublishedRequisites, type PublishedRequisites } from "../lib/requisites-guard.ts";

const sampleRequisites: PublishedRequisites = {
  legalName: "ООО Пример",
  inn: "1098765432",
  ogrn: "1234567890123",
  address: "г. Пример, ул. Примерная, д. 1",
  phone: "+7 900 111-22-33",
  phoneHref: "tel:+79001112233",
};

describe("requisites guard", () => {
  it("keeps stored requisites empty and refuses to publish blanks or sample values", () => {
    assert.equal(company.legalName, "");
    assert.equal(company.inn, "");
    assert.equal(company.ogrn, "");
    assert.equal(company.address, "");
    assert.equal(company.phone, "");
    assert.equal(company.phoneHref, "");
    assert.doesNotThrow(() => assertPublishedRequisites(false, company));
    assert.throws(() => assertPublishedRequisites(true, company), /Реквизиты пустые/);
    assert.throws(
      () => assertPublishedRequisites(true, { ...sampleRequisites, inn: "0000000000" }),
      /Тестовый ИНН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...sampleRequisites, inn: "7700000000" }),
      /Тестовый ИНН/,
    );
    assert.throws(
      () => assertPublishedRequisites(true, { ...sampleRequisites, address: "г. Пример, {{address}}" }),
      /Плейсхолдер в реквизитах/,
    );
    assert.equal(assertPublishedRequisites(true, sampleRequisites), undefined);
  });
});

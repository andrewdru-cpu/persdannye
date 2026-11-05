import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import AccessibilityPage from "../app/accessibility/page.tsx";
import { Footer } from "../components/layout/Footer.tsx";
import {
  ACCESSIBILITY_BADGE,
  ACCESSIBILITY_REVIEW_METHOD,
  ACCESSIBILITY_STATUS,
} from "./accessibility.ts";
import { footerLinks } from "./footer-nav.ts";
import { operatorConsentPhrase } from "./consents.ts";
import { npdIdentityClause } from "./npd.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function routeFile(href: string): string {
  const pathname = href.split("#")[0] || "/";
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return path.join(root, "app/page.tsx");
  return path.join(root, "app", ...parts, "page.tsx");
}

function withOperatorEnv(
  fio: string | undefined,
  inn: string | undefined,
  run: () => void,
) {
  const previousFio = process.env.OPERATOR_FIO;
  const previousInn = process.env.OPERATOR_INN;
  const previousPreview = process.env.VERCEL_ENV;
  if (fio === undefined) delete process.env.OPERATOR_FIO;
  else process.env.OPERATOR_FIO = fio;
  if (inn === undefined) delete process.env.OPERATOR_INN;
  else process.env.OPERATOR_INN = inn;
  delete process.env.VERCEL_ENV;
  try {
    run();
  } finally {
    if (previousFio === undefined) delete process.env.OPERATOR_FIO;
    else process.env.OPERATOR_FIO = previousFio;
    if (previousInn === undefined) delete process.env.OPERATOR_INN;
    else process.env.OPERATOR_INN = previousInn;
    if (previousPreview === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousPreview;
  }
}

describe("footer links", () => {
  it("points only at pages that exist under app/", () => {
    const home = readFileSync(path.join(root, "components/landing/Sections.tsx"), "utf8");
    const page = readFileSync(path.join(root, "app/page.tsx"), "utf8");
    assert.match(home, /id="checks"/);
    assert.match(home, /id="faq"/);
    assert.match(page, /<WhatWeCheck/);
    assert.match(page, /<FAQ/);
    for (const item of footerLinks) {
      assert.equal(existsSync(routeFile(item.href)), true, item.href);
    }
  });

  it("renders the legal row and hides organization requisites", () => {
    withOperatorEnv(undefined, undefined, () => {
      const footer = renderToStaticMarkup(Footer());
      for (const item of footerLinks) {
        assert.match(footer, new RegExp(`href="${item.href}"`));
        assert.match(footer, new RegExp(item.label));
      }
      assert.match(footer, /Плательщик налога на профессиональный доход/);
      assert.equal(footer.includes("ИНН "), false);
      assert.equal(footer.includes("ОГРН"), false);
      assert.equal(footer.includes("ООО"), false);
      assert.equal(footer.includes("ИП"), false);
      assert.equal(footer.includes("компания"), false);
      assert.equal(footer.includes("юридическое лицо"), false);
      assert.equal(footer.includes("t.me"), false);
      assert.equal(footer.includes("vk.com"), false);
    });
  });

  it("fills the NPD line from env and still omits OGRN, phone, and address", () => {
    withOperatorEnv("Пример Пример Пример", "109876543252", () => {
      const footer = renderToStaticMarkup(Footer());
      assert.match(
        footer,
        /Пример Пример Пример, плательщик налога на профессиональный доход, ИНН 109876543252/,
      );
      assert.equal(footer.includes("ОГРН"), false);
      assert.equal(footer.includes("ООО"), false);
      assert.equal(footer.includes("ИП "), false);
      assert.equal(footer.includes("компания"), false);
      assert.equal(footer.includes("+7"), false);
      assert.equal(footer.includes("ул."), false);
    });
  });
});

describe("accessibility statement", () => {
  it("states a partial goal and does not claim a certificate", () => {
    withOperatorEnv(undefined, undefined, () => {
      const html = renderToStaticMarkup(AccessibilityPage());
      assert.match(html, /Заявление о доступности/);
      assert.match(html, new RegExp(ACCESSIBILITY_BADGE));
      assert.match(html, new RegExp(ACCESSIBILITY_STATUS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(html, /Дата заявления: 5 ноября 2026/);
      assert.match(html, /Дата последней проверки: 5 ноября 2026/);
      assert.match(html, new RegExp(ACCESSIBILITY_REVIEW_METHOD));
      assert.match(html, /ГОСТ Р 52872-2019/);
      assert.match(html, /Что реализовано/);
      assert.match(html, /Что в работе и ограничения/);
      assert.match(html, /PDF-отчёт/);
      assert.match(html, /Капча/);
      assert.match(html, /10 рабочих дней/);
      assert.match(html, /цели 4/);
      assert.match(html, /href="\/privacy"/);
      assert.match(html, /href="\/"/);
      assert.match(html, /← на главную/);
      assert.match(html, /Скрипт аналитики на сайте не используется/);
      assert.equal(html.includes("Владелец сайта"), false);
      assert.equal(html.includes("TODO:"), false);
      assert.equal(html.includes("полностью соответствует"), false);
      assert.equal(html.includes("сертифицирован"), false);
      assert.equal(html.includes("доступен для всех"), false);
      assert.equal(html.includes("одобрено"), false);
      assert.equal(html.includes("Роскомнадзор"), false);
      assert.equal(html.includes("обязателен"), false);
      assert.equal(html.toLowerCase().includes("соответствует wcag"), false);
    });
  });

  it("uses the same FIO and INN placeholders as the footer", () => {
    const source = readFileSync(new URL("./npd.ts", import.meta.url), "utf8");
    assert.match(source, /\{\{operator_fio\}\}/);
    assert.match(source, /\{\{operator_inn\}\}/);
    withOperatorEnv("Пример Пример Пример", "109876543252", () => {
      assert.equal(
        npdIdentityClause(false),
        "Пример Пример Пример, плательщик налога на профессиональный доход, ИНН 109876543252",
      );
      const html = renderToStaticMarkup(AccessibilityPage());
      assert.match(html, /Владелец сайта — Пример Пример Пример, плательщик налога на профессиональный доход, ИНН 109876543252/);
      assert.equal(
        operatorConsentPhrase("full"),
        "Пример Пример Пример, плательщик налога на профессиональный доход, ИНН 109876543252 (далее — Оператор)",
      );
      assert.equal(operatorConsentPhrase("full").includes(") (далее"), false);
    });
  });

  it("does not print TODO in a production render when requisites are empty", () => {
    withOperatorEnv(undefined, undefined, () => {
      process.env.VERCEL_ENV = "production";
      const page = renderToStaticMarkup(AccessibilityPage());
      const footer = renderToStaticMarkup(Footer());
      assert.equal(page.includes("TODO:"), false);
      assert.equal(footer.includes("TODO:"), false);
      assert.equal(page.includes("Владелец сайта"), false);
    });
  });
});

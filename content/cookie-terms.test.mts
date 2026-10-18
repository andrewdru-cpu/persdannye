import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COOKIE_BANNER_ACTIONS,
  COOKIE_CONTACTS_SENTENCE,
  COOKIE_SECTION_CATEGORIES,
  COOKIE_SECTION_CONSENT,
  COOKIE_SECTION_RETENTION,
  COOKIE_SECTION_WHAT,
  COOKIE_SETTINGS_LABEL,
  cookieContactsText,
} from "./cookies-policy.ts";
import { fillPlaceholders } from "./placeholders.ts";
import { flags } from "./flags.ts";
import { privacyContactLabel } from "../lib/company.ts";
import {
  consentFromChoice,
  readStoredCookieConsent,
  type CookieConsent,
} from "../lib/cookie-consent.ts";

function source(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

const lawyerSections = {
  "1. Что это.": COOKIE_SECTION_WHAT,
  "2. Категории.": COOKIE_SECTION_CATEGORIES,
  "3. Согласие и отзыв.": COOKIE_SECTION_CONSENT,
  "4. Срок хранения.": COOKIE_SECTION_RETENTION,
  "7. Контакты.": COOKIE_CONTACTS_SENTENCE,
} as const;

describe("cookie and terms copy", () => {
  it("keeps the publication flags off and does not mount metrika", () => {
    assert.equal(flags.show_terms, false);
    assert.equal(flags.show_cookie_policy, false);
    const gate = source("components/layout/AnalyticsGate.tsx");
    assert.equal(gate.includes("return null"), true);
    assert.equal(gate.includes("mc.yandex"), false);
    assert.equal(gate.includes("ym("), false);
  });

  it("uses the lawyer title, acceptance, and liability limit on /terms", () => {
    const page = source("app/terms/page.tsx");
    assert.equal(page.includes("Пользовательское соглашение (публичная оферта)"), false);
    assert.equal(page.includes("Пользовательское соглашение"), true);
    const compact = page.replace(/\s+/g, " ");
    assert.equal(compact.includes("Начиная проверку сайта, пользователь принимает условия соглашения."), true);
    assert.equal(
      compact.includes(
        "в пределах, допускаемых законодательством РФ, в том числе Законом о защите прав потребителей.",
      ),
      true,
    );
    assert.equal(page.includes("visiblePhone("), true);
    assert.equal(page.includes("{company.phone}"), false);
    assert.equal(page.includes("ИНН {company.inn}"), false);
    assert.equal(page.includes("ОГРН {company.ogrn}"), false);
  });

  it("replaces cookie sections 1–4 and 7 verbatim and drops the marketing category", () => {
    const page = source("app/cookies/page.tsx");
    const policy = source("content/cookies-policy.ts");
    const banner = source("components/layout/CookieBanner.tsx");
    const verbatim = [
      `1. Что это. ${COOKIE_SECTION_WHAT}`,
      `2. Категории. ${COOKIE_SECTION_CATEGORIES}`,
      `3. Согласие и отзыв. ${COOKIE_SECTION_CONSENT}`,
      `4. Срок хранения. ${COOKIE_SECTION_RETENTION}`,
      `7. Контакты. ${COOKIE_CONTACTS_SENTENCE}`,
    ];
    assert.equal(
      verbatim[0],
      "1. Что это. Сайт использует cookie и аналогичные технологии (локальное хранилище браузера), чтобы работать и запоминать ваш выбор, а с вашего согласия — измерять посещаемость.",
    );
    assert.equal(
      verbatim[1],
      "2. Категории. Необходимые — работа сайта, безопасность, хранение вашего выбора по cookie; включены всегда, согласия не требуют. Аналитические — сервис Яндекс Метрика (ООО «ЯНДЕКС»): статистика посещений, cookie-идентификатор, IP-адрес, сведения о браузере и устройстве; включаются только после согласия.",
    );
    assert.equal(
      verbatim[2],
      "3. Согласие и отзыв. При первом визите показывается баннер с кнопками «Принять», «Отклонить» и «Настроить». «Отклонить» оставляет только необходимые. Изменить или отозвать выбор можно в любой момент по ссылке «Настройки cookie» внизу страницы; после отзыва аналитика не загружается.",
    );
    assert.equal(
      verbatim[3],
      "4. Срок хранения. Выбор по cookie хранится в браузере до его очистки или изменения выбора. Cookie Метрики — по сроку, установленному Яндексом [УТОЧНИТЬ по факту подключения], либо до отзыва согласия.",
    );
    assert.equal(verbatim[4], "7. Контакты. Вопросы — {{privacy_contact_email}}.");
    for (const [title, body] of Object.entries(lawyerSections)) {
      assert.equal(page.includes(title), true, title);
      assert.equal(policy.includes(body), true, title);
    }
    assert.equal(page.includes("COOKIE_SECTION_WHAT"), true);
    assert.equal(page.includes("cookieContactsText"), true);
    assert.equal(page.includes("Маркетинговые"), false);
    assert.equal(policy.includes("Маркетинговые"), false);
    assert.equal(page.includes("тел."), false);
    assert.equal(banner.includes("Маркетинговые"), false);
    assert.equal(banner.includes("marketing"), false);
    assert.equal(banner.includes("COOKIE_BANNER_ACTIONS"), true);
    assert.equal(banner.includes("{acceptLabel}"), true);
    assert.equal(banner.includes("{rejectLabel}"), true);
    assert.equal(banner.includes("{settingsLabel}"), true);
    assert.equal(banner.includes('consentFromChoice("reject"'), true);
    assert.deepEqual(COOKIE_BANNER_ACTIONS, ["Принять", "Отклонить", "Настроить"]);
  });

  it("keeps the clarify placeholder and substitutes the privacy email only when it is set", () => {
    assert.equal(fillPlaceholders(COOKIE_SECTION_RETENTION, true), COOKIE_SECTION_RETENTION);
    assert.equal(fillPlaceholders(COOKIE_SECTION_RETENTION, false), COOKIE_SECTION_RETENTION);
    assert.equal(cookieContactsText(null), COOKIE_CONTACTS_SENTENCE);
    assert.equal(cookieContactsText(""), COOKIE_CONTACTS_SENTENCE);
    assert.equal(cookieContactsText("a@b.c"), "Вопросы — a@b.c.");
    assert.equal(cookieContactsText(privacyContactLabel("", "production")), COOKIE_CONTACTS_SENTENCE);
    assert.equal(
      cookieContactsText(privacyContactLabel("", "preview")),
      "Вопросы — TODO: privacy_contact_email.",
    );
  });

  it("puts the cookie settings link in the footer outside the publication flags", () => {
    const footer = source("components/layout/Footer.tsx");
    const link = source("components/layout/CookieSettingsLink.tsx");
    const policy = source("content/cookies-policy.ts");
    assert.equal(footer.includes("<CookieSettingsLink />"), true);
    assert.equal(link.includes("COOKIE_SETTINGS_LABEL"), true);
    assert.equal(policy.includes(COOKIE_SETTINGS_LABEL), true);
    assert.equal(link.includes("show_cookie_policy"), false);
    assert.equal(link.includes("flags"), false);
    const documents = footer.slice(footer.indexOf("Документы"), footer.indexOf("Оператор"));
    assert.equal(documents.includes("<CookieSettingsLink />"), true);
    assert.equal(documents.includes("show_"), false);
  });
});

describe("stored cookie choice", () => {
  it("rejects optional categories and accepts only analytics", () => {
    const rejected = consentFromChoice("reject", true, "2026-10-19T00:00:00.000Z");
    const accepted = consentFromChoice("accept", false, "2026-10-19T00:00:00.000Z");
    const custom = consentFromChoice("custom", true, "2026-10-19T00:00:00.000Z");
    assert.equal(rejected.analytics, false);
    assert.equal(accepted.analytics, true);
    assert.equal(custom.analytics, true);
    for (const choice of [rejected, accepted, custom]) {
      assert.equal(choice.necessary, true);
      assert.equal(Object.hasOwn(choice, "marketing"), false);
    }
  });

  it("ignores a stored marketing category without throwing", () => {
    const legacy = JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const read = readStoredCookieConsent(legacy);
    assert.ok(read);
    assert.equal(read.droppedMarketing, true);
    assert.equal(read.consent.analytics, false);
    assert.equal(Object.hasOwn(read.consent, "marketing"), false);
    const fresh = readStoredCookieConsent(
      JSON.stringify({ necessary: true, analytics: true, updatedAt: "2026-02-01T00:00:00.000Z" } satisfies CookieConsent),
    );
    assert.equal(fresh?.droppedMarketing, false);
    assert.equal(fresh?.consent.analytics, true);
    assert.equal(readStoredCookieConsent("not-json"), null);
    assert.equal(readStoredCookieConsent("null"), null);
    assert.equal(readStoredCookieConsent(JSON.stringify({ marketing: true })), null);
    assert.equal(readStoredCookieConsent(JSON.stringify([])), null);
  });
});

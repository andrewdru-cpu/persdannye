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
import { formCopy } from "./blocks.ts";
import { renderHero } from "./landing.ts";
import { editionCaption, fillPlaceholders, placeholders } from "./placeholders.ts";
import { flags } from "./flags.ts";
import { privacyContactLabel } from "../lib/company.ts";
import { TERMS_LIABILITY, scanTermsNotice, termsSubjectSentence } from "./terms-copy.ts";
import {
  COOKIE_CONSENT_TEXT_VERSION,
  consentFromChoice,
  evaluateCookieConsent,
  loadCookieConsent,
  resetCookieConsentSession,
} from "../lib/cookie-consent.ts";

function source(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

const lawyerSections = {
  "1. Что это": COOKIE_SECTION_WHAT,
  "2. Категории": COOKIE_SECTION_CATEGORIES,
  "3. Согласие и отзыв": COOKIE_SECTION_CONSENT,
  "4. Срок хранения": COOKIE_SECTION_RETENTION,
  "7. Контакты": COOKIE_CONTACTS_SENTENCE,
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

  it("uses the lawyer title, subject, and liability on /terms", () => {
    const page = source("app/terms/page.tsx");
    const copy = source("content/terms-copy.ts");
    assert.equal(page.includes("Пользовательское соглашение (публичная оферта)"), false);
    assert.equal(page.includes("публичной офертой"), false);
    assert.equal(page.includes("Пользовательское соглашение"), true);
    assert.equal(page.includes("21.09.2026"), false);
    assert.equal(page.includes("{{terms_edition_date}}"), true);
    assert.equal(page.includes("TERMS_LIABILITY"), true);
    assert.equal(TERMS_LIABILITY, "Сервис предоставляется «как есть». В пределах, допускаемых законодательством РФ, в том числе Законом РФ «О защите прав потребителей», Оператор не отвечает за временную недоступность Сервиса, неполноту автоматической проверки, изменения на сайте пользователя после сканирования, а также за убытки, возникшие вследствие решений, принятых исключительно на основе экспресс-отчёта.");
    const filled = termsSubjectSentence({
      legalName: "ООО «Пример»",
      idLine: "ИНН 1098765432, ОГРН 1234567890123",
      website: "https://persdannye.ru",
    });
    assert.equal(
      filled,
      "Настоящее соглашение заключается между ООО «Пример» (ИНН 1098765432, ОГРН 1234567890123) (далее — Оператор) и пользователем и регулирует использование сайта https://persdannye.ru и бесплатного сервиса экспресс-проверки сайтов на признаки несоответствия требованиям 152-ФЗ и практике Роскомнадзора (далее — Сервис).",
    );
    assert.equal(termsSubjectSentence({ legalName: null, idLine: null, website: null }).includes("()"), false);
    assert.equal(termsSubjectSentence({ legalName: "ООО «Пример»", idLine: null, website: "" }).includes("()"), false);
    assert.equal(copy.includes("«бесплатного» убрать, если экспресс-проверка перестанет быть бесплатной."), true);
    assert.equal(page.includes("«бесплатного» убрать, если экспресс-проверка перестанет быть бесплатной."), true);
    assert.equal(page.includes("Начиная проверку сайта, пользователь принимает условия соглашения."), true);
    assert.equal(page.includes("visiblePhone("), true);
    assert.equal(page.includes("{company.phone}"), false);
    assert.equal(page.includes("ИНН {company.inn}"), false);
    assert.equal(page.includes("ОГРН {company.ogrn}"), false);
    assert.equal(editionCaption("{{terms_edition_date}}"), null);
    assert.equal(placeholders.terms_edition_date, "");
    assert.equal(
      editionCaption("{{terms_edition_date}}", { terms_edition_date: "01.01.2026" }),
      "Редакция от 01.01.2026",
    );
  });

  it("shows the terms notice only next to the scan button when the flag is on", () => {
    assert.equal(flags.show_terms, false);
    assert.equal(formCopy.button, "Проверить сайт");
    assert.equal(renderHero().cta, formCopy.button);
    assert.equal(scanTermsNotice(formCopy.button, false), null);
    assert.equal(scanTermsNotice(formCopy.button), null);
    const notice = scanTermsNotice(formCopy.button, true);
    assert.ok(notice);
    assert.equal(notice.href, "/terms");
    assert.equal(notice.linkText, "Пользовательское соглашение");
    assert.equal(
      `${notice.before}${notice.linkText}`,
      "Нажимая «Проверить сайт», вы принимаете Пользовательское соглашение",
    );
    const checker = source("components/check/UrlChecker.tsx");
    assert.equal(checker.includes("scanTermsNotice(ctaLabel, flags.show_terms)"), true);
    assert.equal(checker.includes('href={termsNotice.href}'), true);
    assert.equal(source("app/check/page.tsx").includes("<UrlChecker"), true);
    assert.equal(source("components/landing/Sections.tsx").includes("<UrlChecker"), true);
    assert.equal(source("app/page.tsx").includes("ctaLabel={hero.cta}"), true);
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
      assert.equal(page.includes(`title="${title}"`), true, title);
      assert.equal(page.includes(`title="${title}."`), false, title);
      assert.equal(policy.includes(body), true, title);
    }
    assert.equal(page.includes("21.09.2026"), false);
    assert.equal(page.includes("{{cookie_policy_edition_date}}"), true);
    assert.equal(editionCaption("{{cookie_policy_edition_date}}"), null);
    assert.equal(placeholders.cookie_policy_edition_date, "");
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

  it("puts the cookie settings link in the footer only while collection is enabled", () => {
    const footer = source("components/layout/Footer.tsx");
    const link = source("components/layout/CookieSettingsLink.tsx");
    const policy = source("content/cookies-policy.ts");
    assert.equal(footer.includes("<CookieSettingsLink />"), true);
    assert.equal(footer.includes("collectionEnabled()"), true);
    assert.equal(link.includes("COOKIE_SETTINGS_LABEL"), true);
    assert.equal(policy.includes(COOKIE_SETTINGS_LABEL), true);
    assert.equal(link.includes("show_cookie_policy"), false);
    assert.equal(link.includes("flags"), false);
    assert.equal(link.includes("collectionEnabled"), false);
    const documents = footer.slice(footer.indexOf("Документы"), footer.indexOf("Оператор"));
    assert.equal(documents.includes("collectionEnabled() ? ("), true);
    assert.equal(documents.includes("<CookieSettingsLink />"), true);
    assert.equal(documents.includes("show_"), false);
  });
});

describe("stored cookie choice", () => {
  it("rejects optional categories and stamps the current text version", () => {
    const rejected = consentFromChoice("reject", true, "2026-10-19T00:00:00.000Z");
    const accepted = consentFromChoice("accept", false, "2026-10-19T00:00:00.000Z");
    assert.equal(COOKIE_CONSENT_TEXT_VERSION, "2026-10-19-cookie");
    assert.equal(rejected.analytics, false);
    assert.equal(accepted.analytics, true);
    assert.equal(rejected.textVersion, COOKIE_CONSENT_TEXT_VERSION);
    assert.equal(accepted.textVersion, COOKIE_CONSENT_TEXT_VERSION);
    assert.equal(Object.hasOwn(rejected, "marketing"), false);
    assert.equal(Object.hasOwn(accepted, "marketing"), false);
  });

  it("drops v1, re-prompts on a stale text version, and keeps the current v2 choice", () => {
    resetCookieConsentSession();
    const store = new Map<string, string>([
      ["pd_cookie_consent_v1", JSON.stringify({ necessary: true, analytics: true, marketing: true, updatedAt: "2026-01-01T00:00:00.000Z" })],
      ["pd_cookie_consent_v2", JSON.stringify(consentFromChoice("accept", true, "2026-10-19T00:00:00.000Z"))],
    ]);
    const storage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    const fromV1 = loadCookieConsent(storage);
    assert.equal(store.has("pd_cookie_consent_v1"), false);
    assert.equal(fromV1.showBanner, true);
    assert.equal(fromV1.analyticsConsented, false);
    const again = loadCookieConsent(storage);
    assert.equal(again.showBanner, true);
    assert.equal(again.analyticsConsented, false);

    resetCookieConsentSession();
    const stale = JSON.stringify({
      necessary: true,
      analytics: true,
      textVersion: "2026-01-01-cookie",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const fromStale = evaluateCookieConsent(null, stale);
    assert.equal(fromStale.showBanner, true);
    assert.equal(fromStale.analyticsConsented, false);

    const current = JSON.stringify(consentFromChoice("accept", true, "2026-10-19T00:00:00.000Z"));
    const fromCurrent = evaluateCookieConsent(null, current);
    assert.equal(fromCurrent.showBanner, false);
    assert.equal(fromCurrent.analyticsConsented, true);
    resetCookieConsentSession();
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCalculator, emptyAnswers } from "./calculator.ts";
import { flags } from "./flags.ts";
import {
  claimPlaceholders,
  claims,
  renderHero,
  renderedLandingCopy,
} from "./landing.ts";

/** Рекламные формулировки, которых не должно быть в показанном тексте лендинга. */
const bannedPatterns: RegExp[] = [
  /(?<!не\s)гаранти/iu,
  /100\s*%\s*защит/iu,
  /аккредитован/iu,
  /одобрено\s+ркн/iu,
  /обнулим\s+штраф/iu,
  /спите\s+спокойно/iu,
  /закрываем\s+все\s+риск/iu,
  /мы\s+закрываем\s+риск\p{L}*\s+за\s+вас/iu,
  /ни\s+один\s+конкурент/iu,
  /по\s+данным\s+ркн/iu,
  /мониторинг\s+24\s*\/\s*7/iu,
  /рекомендовано\s+ркн/iu,
  /по\s+стандартам\s+ркн/iu,
  /лучш(?:ий|ая|ее|ие)/iu,
  /первый/iu,
  /№\s*1/u,
  /ркн\s+уже\s+сканирует/iu,
  /роскомнадзор\s+уже\s+сканирует/iu,
  /24\s*\/\s*7/u,
  /1000\s*\+\s*клиент/iu,
  /ежедневн\p{L}*\s+актуализац/iu,
  /передовая\s+компани/iu,
  /без\s+штраф/iu,
  /100\s*%\s*соответств/iu,
  /закроем\s+риск/iu,
  /защитим\s+от\s+ркн/iu,
  /87\s*%/u,
  /единственн/iu,
  /в\s+отличие\s+от/iu,
  /официальн\p{L}*\s+проверк/iu,
  /реестр\s+ркн/iu,
  /штрафа\s+не\s+будет/iu,
  /сначала\s+только\s+предупредят/iu,
  /в\s+течение\s+года\s+с\s+нарушен/iu,
];

const timeClaim = /за\s+(?:60\s+секунд|минуту|несколько\s+минут)/iu;
const checksClaim = /десятк\p{L}*\s+проверок/iu;

const MAIN_H1 = "Проверьте сайт на соответствие 152-ФЗ — и получите план, что исправить";
const MAIN_H1_TIME =
  "Проверьте сайт на соответствие 152-ФЗ за несколько минут — и получите план, что исправить";
const SUB =
  "Политика, согласия, cookie, формы и сторонние сервисы — проверяем публичную часть сайта. Автоматическая проверка, не является юридической консультацией.";
const SUB_CHECKS =
  "Политика, согласия, cookie, формы и сторонние сервисы — десятки проверок публичной части сайта. Автоматическая проверка, не является юридической консультацией.";

describe("rendered landing copy", () => {
  const live = renderedLandingCopy();

  it("keeps both claim flags off", () => {
    assert.equal(claims.time_verified, false);
    assert.equal(claims.checks_count_verified, false);
  });

  it("does not contain banned advertising phrases", () => {
    for (const pattern of bannedPatterns) {
      assert.equal(pattern.test(live), false, pattern.source);
    }
  });

  it("does not render a ruble amount while the fines flag is off", () => {
    assert.equal(live.includes("₽"), false);
  });

  it("shows the main hero without a time or count claim", () => {
    const resolved = renderHero();
    assert.equal(resolved.headline, MAIN_H1);
    assert.equal(resolved.subline, SUB);
    assert.equal(resolved.cta, "Проверить сайт");
    assert.equal(timeClaim.test(live), false);
    assert.equal(checksClaim.test(live), false);
    assert.equal(live.includes(claimPlaceholders.time), false);
    assert.equal(live.includes(claimPlaceholders.checks), false);
    assert.equal(live.includes("Даже лендинг с формой"), false);
    assert.equal(live.includes("проверим и покажем, что поправить"), false);
    assert.equal(live.includes("до того, как это сделает проверка"), false);
    assert.equal(live.includes("десятки пунктов"), false);
    assert.equal(live.includes("Обычно это занимает несколько минут"), false);
  });

  it("inserts the time phrase into the main H1 only when time_verified is true", () => {
    const resolved = renderHero({
      claims: { time_verified: true, checks_count_verified: false },
    });
    assert.equal(resolved.headline, MAIN_H1_TIME);
    assert.equal(resolved.subline, SUB);
    assert.equal(resolved.subline.includes(claimPlaceholders.checks), false);
  });

  it("rewrites the dash in the sub only when checks_count_verified is true", () => {
    const resolved = renderHero({
      claims: { time_verified: false, checks_count_verified: true },
    });
    assert.equal(resolved.headline, MAIN_H1);
    assert.equal(resolved.subline, SUB_CHECKS);
    assert.equal(resolved.headline.includes(claimPlaceholders.time), false);
  });

  it("renders both claim phrases only when both flags are true", () => {
    const resolved = renderHero({
      claims: { time_verified: true, checks_count_verified: true },
    });
    assert.equal(resolved.headline, MAIN_H1_TIME);
    assert.equal(resolved.subline, SUB_CHECKS);
  });
});

describe("publication flags", () => {
  it("keeps every section-0 flag off", () => {
    for (const [name, value] of Object.entries(flags)) {
      assert.equal(value, false, name);
    }
  });
});

describe("calculator without amounts", () => {
  it("shows a fix card and no ruble amount when the policy is missing", () => {
    const view = resolveCalculator({ ...emptyAnswers, owner: "ip", policy: "no" });
    const text = JSON.stringify(view);
    assert.equal(view.cards.some((card) => card.norm.includes("ч. 3")), true);
    assert.equal(text.includes("₽"), false);
    assert.equal(text.includes("тыс"), false);
  });

  it("replaces an unknown answer with the site-check line", () => {
    const view = resolveCalculator({ ...emptyAnswers, policy: "unknown" });
    assert.equal(view.cards.length, 0);
    assert.equal(view.unknowns.includes("Политика"), true);
  });

  it("keeps localization wording conditional", () => {
    const view = resolveCalculator({
      ...emptyAnswers,
      foreignStorage: true,
    });
    const card = view.cards.find((item) => item.id === "localization");
    assert.equal(card?.neutral, true);
    assert.equal(card?.paragraphs.join(" ").includes("Только если"), true);
  });
});

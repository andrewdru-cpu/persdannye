import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeHeroVariant,
  claimPlaceholders,
  claims,
  hero,
  heroNearbyCopy,
  renderHero,
  renderedLandingCopy,
} from "./landing.ts";

/** Рекламные формулировки, которых не должно быть в показанном тексте лендинга. */
const bannedPatterns: RegExp[] = [
  /гаранти/iu,
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
];

const timeClaim = /за\s+(?:60\s+секунд|минуту|несколько\s+минут)/iu;
const checksClaim = /десятк\p{L}*\s+проверок/iu;
const nearbyTimer = /за\s+(?:60\s+секунд|минуту|несколько\s+минут)|секунд|минут|24\s*\/\s*7/iu;

const MAIN_H1 = "Проверьте сайт на соответствие 152-ФЗ — и получите план, что исправить";
const MAIN_H1_TIME =
  "Проверьте сайт на соответствие 152-ФЗ за несколько минут — и получите план, что исправить";
const SUB =
  "Политика, согласия, cookie, формы и сторонние сервисы — проверка публичной части сайта. Автоматическая проверка, не является юридической консультацией.";
const SUB_CHECKS =
  "Политика, согласия, cookie, формы и сторонние сервисы — десятки проверок публичной части сайта. Автоматическая проверка, не является юридической консультацией.";
const FALLBACK_H1 = "Персональные данные на сайте: проверим и покажем, что поправить";
const VARIANT_C_H1 =
  "Узнайте, что на вашем сайте не так с 152-ФЗ, — до того, как это сделает проверка";

describe("rendered landing copy", () => {
  const live = renderedLandingCopy();

  it("keeps claim flags off, variant C off, and main selected", () => {
    assert.equal(claims.time_verified, false);
    assert.equal(claims.checks_count_verified, false);
    assert.equal(hero.variant_c_enabled, false);
    assert.equal(activeHeroVariant, "main");
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
    assert.equal(resolved.variant, "main");
    assert.equal(resolved.headline, MAIN_H1);
    assert.equal(resolved.subline, SUB);
    assert.equal(resolved.cta, "Проверить сайт");
    assert.equal(resolved.hideNearbyTimers, false);
    assert.equal(timeClaim.test(live), false);
    assert.equal(checksClaim.test(live), false);
    assert.equal(live.includes(claimPlaceholders.time), false);
    assert.equal(live.includes(claimPlaceholders.checks), false);
    assert.equal(live.includes("Даже лендинг с формой"), false);
  });

  it("inserts the time phrase into the main H1 only when time_verified is true", () => {
    const resolved = renderHero({
      variant: "main",
      claims: { time_verified: true, checks_count_verified: false },
    });
    assert.equal(resolved.headline, MAIN_H1_TIME);
    assert.equal(resolved.subline, SUB);
    assert.equal(resolved.subline.includes(claimPlaceholders.checks), false);
  });

  it("rewrites the dash in the sub only when checks_count_verified is true", () => {
    const resolved = renderHero({
      variant: "main",
      claims: { time_verified: false, checks_count_verified: true },
    });
    assert.equal(resolved.headline, MAIN_H1);
    assert.equal(resolved.subline, SUB_CHECKS);
    assert.equal(resolved.headline.includes(claimPlaceholders.time), false);
  });

  it("renders both claim phrases only when both flags are true", () => {
    const resolved = renderHero({
      variant: "main",
      claims: { time_verified: true, checks_count_verified: true },
    });
    assert.equal(resolved.headline, MAIN_H1_TIME);
    assert.equal(resolved.subline, SUB_CHECKS);
  });

  it("keeps fallback on the same sub as main", () => {
    const resolved = renderHero({ variant: "fallback" });
    assert.equal(resolved.headline, FALLBACK_H1);
    assert.equal(resolved.subline, SUB);
    assert.equal(resolved.cta, "Проверить сайт");
    assert.equal(
      renderHero({
        variant: "fallback",
        claims: { time_verified: true, checks_count_verified: false },
      }).headline,
      FALLBACK_H1,
    );
  });

  it("does not render variant C while hero.variant_c_enabled is false", () => {
    const resolved = renderHero({ variant: "c" });
    assert.equal(resolved.variant, "main");
    assert.equal(resolved.headline, MAIN_H1);
  });

  it("keeps variant C free of amounts, timers, and the word РКН", () => {
    const resolved = renderHero({
      variant: "c",
      variantCEnabled: true,
      claims: { time_verified: true, checks_count_verified: true },
    });
    const nearby = heroNearbyCopy(resolved);
    assert.equal(resolved.variant, "c");
    assert.equal(resolved.headline, VARIANT_C_H1);
    assert.equal(resolved.headline.includes("проверка"), true);
    assert.equal(/ркн/iu.test(resolved.headline), false);
    assert.equal(resolved.hideNearbyTimers, true);
    assert.equal(resolved.hideNearbyAmounts, true);
    assert.equal(nearby.includes("₽"), false);
    assert.equal(nearbyTimer.test(nearby), false);
    assert.equal(resolved.headline.includes(claimPlaceholders.time), false);
    assert.equal(resolved.subline, SUB_CHECKS);
  });
});

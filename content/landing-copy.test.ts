import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeHeroVariant,
  claimPlaceholders,
  claims,
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

describe("rendered landing copy", () => {
  const live = renderedLandingCopy();

  it("keeps both claim flags off and the default hero live", () => {
    assert.equal(claims.time_verified, false);
    assert.equal(claims.checks_count_verified, false);
    assert.equal(activeHeroVariant, "default");
  });

  it("does not contain banned advertising phrases", () => {
    for (const pattern of bannedPatterns) {
      assert.equal(pattern.test(live), false, pattern.source);
    }
  });

  it("shows the approved hero without a time or count claim", () => {
    const hero = renderHero();
    assert.equal(
      hero.headline,
      "Даже лендинг с формой делает вас оператором персональных данных",
    );
    assert.equal(
      hero.subline,
      "Проверьте обязательные элементы сайта по 152-ФЗ и получите список наблюдений и план исправлений.",
    );
    assert.equal(timeClaim.test(live), false);
    assert.equal(checksClaim.test(live), false);
    assert.equal(live.includes("минуты"), false);
    assert.equal(live.includes(claimPlaceholders.time), false);
    assert.equal(live.includes(claimPlaceholders.checks), false);
  });

  it("ignores claim flags on the default variant", () => {
    const hero = renderHero({
      variant: "default",
      claims: { time_verified: true, checks_count_verified: true },
    });
    assert.equal(timeClaim.test(hero.subline), false);
    assert.equal(checksClaim.test(hero.subline), false);
  });

  it("omits both placeholders on the claims variant while flags are false", () => {
    const hero = renderHero({ variant: "claims" });
    const copy = renderedLandingCopy({ variant: "claims" });
    assert.equal(hero.subline.includes(claimPlaceholders.time), false);
    assert.equal(hero.subline.includes(claimPlaceholders.checks), false);
    assert.equal(copy.includes(claimPlaceholders.time), false);
    assert.equal(copy.includes(claimPlaceholders.checks), false);
    for (const pattern of bannedPatterns) {
      assert.equal(pattern.test(copy), false, pattern.source);
    }
  });

  it("renders the time phrase only when time_verified is true", () => {
    const hero = renderHero({
      variant: "claims",
      claims: { time_verified: true, checks_count_verified: false },
    });
    assert.equal(hero.subline.includes(claimPlaceholders.time), true);
    assert.equal(hero.subline.includes(claimPlaceholders.checks), false);
  });

  it("renders the checks phrase only when checks_count_verified is true", () => {
    const hero = renderHero({
      variant: "claims",
      claims: { time_verified: false, checks_count_verified: true },
    });
    assert.equal(hero.subline.includes(claimPlaceholders.checks), true);
    assert.equal(hero.subline.includes(claimPlaceholders.time), false);
  });

  it("renders both phrases only when both flags are true", () => {
    const hero = renderHero({
      variant: "claims",
      claims: { time_verified: true, checks_count_verified: true },
    });
    assert.equal(hero.subline.includes(claimPlaceholders.time), true);
    assert.equal(hero.subline.includes(claimPlaceholders.checks), true);
  });
});

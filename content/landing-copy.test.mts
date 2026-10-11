import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCalculator, emptyAnswers } from "./calculator.ts";
import { checkGroupsTitle, faqItems, footerParagraphs, formCopy } from "./blocks.ts";
import { leadConsent, marketingConsent, reportConsent } from "./consents.ts";
import { flags } from "./flags.ts";
import { fillPlaceholders, placeholders } from "./placeholders.ts";
import {
  CHECKS_COUNT_MAX_AGE_MS,
  CHECKS_COUNT_REVALIDATE_SECONDS,
  CHECKS_COUNT_WARN,
  PARSER_CHECKS_COUNT_PATH,
  checksCountForRender,
  parseGeneratedAt,
  parseVisibleChecksCount,
  resetChecksCountCache,
  resolveVisibleChecksCount,
} from "../lib/checks-count.ts";
import { safeHref } from "../lib/safe-href.ts";
import { company, privacyContactLabel, PRIVACY_CONTACT_TODO } from "../lib/company.ts";
import { HERO_SUBLINE_NARROW, heroChecksPhrase, heroSublineNarrowWithCount, heroSublineWithCount } from "../lib/hero-checks.ts";
import {
  claimPlaceholders,
  claims,
  fixWithUs,
  renderHero,
  renderedLandingCopy,
  sampleReport,
  whoFor,
} from "./landing.ts";

/** Рекламные формулировки, которых не должно быть в показанном тексте лендинга. */
const bannedPatterns: RegExp[] = [
  /(?<!не\s)(?<!не\s+можем\s)гаранти/iu,
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
  /example-shop\.ru/iu,
  /балл/iu,
  /не\s+соответствует/iu,
  /найдено\s+\d+\s+риск/iu,
  /сопровождаем\s+до\s+устойчивого\s+соответствия/iu,
  /соглашаетесь/iu,
  /отправляя\s+форму/iu,
  /помощь\s+специалиста/iu,
  /устраним\s+риск/iu,
  /исправим\s+за\s+вас/iu,
  /@persdannye\.ru/iu,
  /п\.\s*3\.1/u,
  /рекомендац\p{L}*\s+ркн/iu,
  /десятк/iu,
  /все\s+требования\s+152-ФЗ/iu,
  /полная\s+проверка/iu,
];

const timeClaim = /за\s+(?:60\s+секунд|минуту|несколько\s+минут)/iu;
const countPhraseBans = [/десятк/iu, /все\s+требования\s+152-ФЗ/iu, /полная\s+проверка/iu];

const MAIN_H1 = "Проверьте сайт на соответствие 152-ФЗ — и получите план, что исправить";
const MAIN_H1_TIME =
  "Проверьте сайт на соответствие 152-ФЗ за несколько минут — и получите план, что исправить";
const SUB =
  "Политика, согласия, cookie, формы и сторонние сервисы — проверяем публичную часть сайта. Автоматическая проверка, не является юридической консультацией.";

describe("rendered landing copy", () => {
  const live = renderedLandingCopy();

  it("keeps the speed and checks-count flags off", () => {
    assert.equal(claims.time_verified, false);
    assert.equal(flags.hero_checks_count, false);
    assert.equal("hero_dozens_claim" in flags, false);
  });

  it("does not contain banned advertising phrases", () => {
    const extra = JSON.stringify({ sampleReport, whoFor, fixWithUs });
    for (const pattern of bannedPatterns) {
      assert.equal(pattern.test(live), false, pattern.source);
      assert.equal(pattern.test(extra), false, pattern.source);
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
    assert.equal(live.includes(claimPlaceholders.time), false);
    assert.equal(live.includes("Даже лендинг с формой"), false);
    assert.equal(live.includes("проверим и покажем, что поправить"), false);
    assert.equal(live.includes("до того, как это сделает проверка"), false);
    assert.equal(checkGroupsTitle, "Что проверяем");
    assert.equal(live.includes("Обычно это занимает несколько минут"), false);
    assert.equal(live.includes("Суммы для ИП и юрлиц разные"), false);
    assert.equal(live.includes("Диапазоны — по ст. 13.11"), false);
    assert.equal(live.includes("в соответствии с"), false);
    assert.equal(live.includes("диапазоны — в таблице выше"), false);
    assert.equal(live.includes("Пример результата"), false);
    assert.equal(live.includes("Устраним вместе"), false);
    assert.equal(live.includes("Как выглядит отчёт"), true);
    assert.equal(live.includes("Кому подходит проверка"), true);
    assert.equal(live.includes("Поможем исправить"), true);
    assert.equal(live.includes("primer-saita.example"), true);
    assert.equal(live.includes(`href="https://primer-saita.example"`), false);
    assert.equal(live.includes(formCopy.policyLead), true);
    assert.equal(live.includes(formCopy.policyLink), true);
  });

  it("inserts the time phrase into the main H1 only when time_verified is true", () => {
    const resolved = renderHero({
      claims: { time_verified: true },
      checksCountEnabled: true,
      checksCount: 40,
    });
    assert.equal(resolved.headline, MAIN_H1_TIME);
    assert.equal(resolved.subline.startsWith("более 20 проверок по 152-ФЗ. "), true);
    assert.equal(resolved.headline.includes("десятк"), false);
  });

  it("does not render the banned count claims for any flag or count", () => {
    for (const enabled of [false, true]) {
      for (const count of [null, 19, 20, 21, 40]) {
        const text = renderedLandingCopy({ checksCountEnabled: enabled, checksCount: count });
        for (const pattern of countPhraseBans) {
          assert.equal(pattern.test(text), false, `${pattern.source} enabled=${enabled} count=${count}`);
        }
        assert.equal(text.includes("Что проверяем: десятки"), false);
      }
    }
  });
});

describe("hero checks count phrase", () => {
  const cases: Array<[number | null, string | null]> = [
    [null, null],
    [19, null],
    [20, "20 проверок по 152-ФЗ"],
    [21, "более 20 проверок по 152-ФЗ"],
    [29, "более 20 проверок по 152-ФЗ"],
    [30, "более 20 проверок по 152-ФЗ"],
    [40, "более 20 проверок по 152-ФЗ"],
    [45, "более 20 проверок по 152-ФЗ"],
  ];

  for (const [count, phrase] of cases) {
    it(`maps N=${count} when the flag is on`, () => {
      assert.equal(heroChecksPhrase(true, count), phrase);
      const subline = heroSublineWithCount(true, count);
      const narrow = heroSublineNarrowWithCount(true, count);
      if (phrase) {
        assert.equal(subline, `${phrase}. ${SUB}`);
        assert.equal(narrow, `${phrase}. ${HERO_SUBLINE_NARROW}`);
      } else {
        assert.equal(subline, SUB);
        assert.equal(narrow, HERO_SUBLINE_NARROW);
      }
      assert.equal(subline.includes("не является юридической консультацией"), true);
      assert.equal(narrow.includes("не юридическая консультация"), true);
    });
  }

  it("keeps the legal disclaimer in both width variants", () => {
    const plain = renderHero();
    assert.equal(plain.subline, SUB);
    assert.equal(plain.sublineNarrow, HERO_SUBLINE_NARROW);
    assert.equal(plain.subline.includes("не является юридической консультацией"), true);
    assert.equal(plain.sublineNarrow.includes("не юридическая консультация"), true);
    const counted = renderHero({ checksCountEnabled: true, checksCount: 30 });
    assert.equal(counted.subline.startsWith("более 20 проверок по 152-ФЗ. "), true);
    assert.equal(counted.sublineNarrow.startsWith("более 20 проверок по 152-ФЗ. "), true);
    assert.equal(counted.subline.endsWith(SUB), true);
    assert.equal(counted.sublineNarrow.endsWith(HERO_SUBLINE_NARROW), true);
  });

  it("drops the phrase when the flag is off even if N is high", () => {
    assert.equal(heroChecksPhrase(false, 40), null);
    assert.equal(heroSublineWithCount(false, 40), SUB);
    assert.equal(renderHero({ checksCountEnabled: false, checksCount: 40 }).subline, SUB);
  });
});

describe("parser checks-count payload", () => {
  it("reads the public path, a 300 second fresh window, and a 24 hour cap", () => {
    assert.equal(PARSER_CHECKS_COUNT_PATH, "/public/checks-count");
    assert.equal(CHECKS_COUNT_REVALIDATE_SECONDS, 300);
    assert.equal(CHECKS_COUNT_MAX_AGE_MS, 24 * 60 * 60 * 1000);
  });

  it("accepts an integer count with a rules version", () => {
    assert.equal(
      parseVisibleChecksCount({ visible_checks_count: 21, rules_version: "2026-10-11" }),
      21,
    );
  });

  it("rejects a non-integer, a missing version, and a broken body", () => {
    assert.equal(parseVisibleChecksCount({ visible_checks_count: 20.5, rules_version: "v" }), null);
    assert.equal(parseVisibleChecksCount({ visible_checks_count: "21", rules_version: "v" }), null);
    assert.equal(parseVisibleChecksCount({ visible_checks_count: 21 }), null);
    assert.equal(parseVisibleChecksCount(null), null);
  });

  it("hides a successful response once it is 24 hours old", () => {
    const start = 1_700_000_000_000;
    const fresh = { count: 21, fetchedAt: start, generatedAt: null };
    assert.equal(checksCountForRender(fresh, start + CHECKS_COUNT_MAX_AGE_MS - 1), 21);
    assert.equal(checksCountForRender(fresh, start + CHECKS_COUNT_MAX_AGE_MS), null);
    assert.equal(heroChecksPhrase(true, checksCountForRender(fresh, start + CHECKS_COUNT_MAX_AGE_MS)), null);
  });

  it("hides the number when a later request fails 25 hours after the last success", async () => {
    resetChecksCountCache();
    const start = 1_700_000_000_000;
    const ok = await resolveVisibleChecksCount(start, async () => ({ count: 21, generatedAt: null }));
    assert.equal(checksCountForRender(ok, start), 21);
    const later = start + 25 * 60 * 60 * 1000;
    const afterError = await resolveVisibleChecksCount(later, async () => {
      throw new Error("timeout");
    });
    assert.equal(checksCountForRender(afterError, later), null);
    assert.equal(heroChecksPhrase(true, checksCountForRender(afterError, later)), null);
  });

  it("keeps a success younger than 24 hours when the next request fails", async () => {
    resetChecksCountCache();
    const start = 1_700_000_000_000;
    await resolveVisibleChecksCount(start, async () => ({ count: 21, generatedAt: null }));
    const later = start + 60 * 60 * 1000;
    const afterError = await resolveVisibleChecksCount(later, async () => {
      throw new Error("timeout");
    });
    assert.equal(checksCountForRender(afterError, later), 21);
  });

  it("treats generated_at as the data age and ignores unknown fields", () => {
    const now = 1_700_000_000_000;
    const body = {
      visible_checks_count: 21,
      rules_version: "2026-10-11",
      generated_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      unexpected: "ignore",
    };
    assert.equal(parseVisibleChecksCount(body), 21);
    const stale = { count: 21, fetchedAt: now, generatedAt: parseGeneratedAt(body) };
    assert.equal(checksCountForRender(stale, now), null);
    const freshBody = { ...body, generated_at: new Date(now - 60_000).toISOString() };
    assert.equal(
      checksCountForRender({ count: 21, fetchedAt: now, generatedAt: parseGeneratedAt(freshBody) }, now),
      21,
    );
    assert.equal(parseGeneratedAt({ ...body, generated_at: "not-a-date" }), null);
  });

  it("warns once per new receipt when N is at least 30", async () => {
    resetChecksCountCache();
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };
    const start = 1_700_000_000_000;
    try {
      await resolveVisibleChecksCount(start, async () => ({ count: 29, generatedAt: null }));
      await resolveVisibleChecksCount(start + 301_000, async () => ({ count: 30, generatedAt: null }));
      await resolveVisibleChecksCount(start + 302_000, async () => ({ count: 30, generatedAt: null }));
      await resolveVisibleChecksCount(start + 700_000, async () => ({ count: 30, generatedAt: null }));
      await resolveVisibleChecksCount(start + 1_100_000, async () => ({ count: 45, generatedAt: null }));
    } finally {
      console.warn = original;
    }
    assert.deepEqual(warnings, [CHECKS_COUNT_WARN, CHECKS_COUNT_WARN]);
    assert.equal(heroChecksPhrase(true, 29), "более 20 проверок по 152-ФЗ");
    assert.equal(heroChecksPhrase(true, 30), "более 20 проверок по 152-ФЗ");
    assert.equal(heroChecksPhrase(true, 45), "более 20 проверок по 152-ФЗ");
  });
});

const section0Flags = [
  "show_fines",
  "show_marketing_consent",
  "calc_client_only",
  "hero_speed_claim",
  "hero_checks_count",
  "hero_alt_check",
  "show_rkn_stats",
  "show_rules_update",
  "show_methodology",
  "show_accuracy",
  "show_prices",
  "show_monitoring",
] as const;

describe("publication flags", () => {
  it("keeps every section-0 flag off", () => {
    for (const name of section0Flags) {
      assert.equal(flags[name], false, name);
    }
  });

  it("shows the approved extra blocks and the rebuilt lead form", () => {
    assert.equal(flags.show_sample_report, true);
    assert.equal(flags.show_who_for, true);
    assert.equal(flags.show_fix_with_us, true);
    assert.equal(flags.show_lead_form, true);
    assert.equal(flags.show_platform_hints, false);
  });

  it("mentions the fines table in FAQ 2 only when that table is shown", () => {
    const hidden = faqItems(false, false).find((item) => item.q.startsWith("Что происходит"));
    const shown = faqItems(false, true).find((item) => item.q.startsWith("Что происходит"));
    assert.equal(hidden?.a.includes("диапазоны — в таблице выше"), false);
    assert.equal(shown?.a.includes("диапазоны — в таблице выше"), true);
  });

  it("maps both mail placeholders to the empty privacy contact", () => {
    assert.equal(company.privacy_contact_email, "");
    assert.equal(company.email, "");
    assert.equal("dpoEmail" in company, false);
    assert.equal(privacyContactLabel("", "production"), null);
    assert.equal(privacyContactLabel("", "preview"), PRIVACY_CONTACT_TODO);
    const consents = JSON.stringify({ reportConsent, marketingConsent, leadConsent });
    assert.equal(consents.includes("operator_email_pd"), false);
    assert.equal(consents.includes("{{privacy_contact_email}}"), true);
    const previous = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    try {
      assert.equal(fillPlaceholders("{{privacy_contact_email}}", true), PRIVACY_CONTACT_TODO);
      assert.equal(fillPlaceholders("{{operator_email_pd}}", true), PRIVACY_CONTACT_TODO);
      assert.equal(fillPlaceholders("{{processor_timeweb_legal}}", true), "TODO: processor_timeweb_legal");
      assert.equal(fillPlaceholders("{{processor_yandex360_legal}}", true), "TODO: processor_yandex360_legal");
      process.env.VERCEL_ENV = "production";
      assert.equal(fillPlaceholders("{{operator_email_pd}}", false), "");
      assert.equal(fillPlaceholders("{{privacy_contact_email}}", false), "");
      assert.equal(fillPlaceholders("{{processor_timeweb_legal}}", false), "");
      assert.equal(fillPlaceholders("{{processor_yandex360_legal}}", false), "");
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });

  it("uses the lawyer text for sample observation 5 and drops the RKN recommendations cite", () => {
    const item = sampleReport.observations[4];
    assert.equal(item?.level, "Желательно");
    assert.equal(item?.text, "В политике не нашли наименование и адрес оператора (PD-POLICY-009)");
    assert.equal(item?.confidence, "Вероятно: реквизиты могут быть на другой странице или картинкой");
    assert.equal(
      item?.fix,
      "Рекомендуем указать в политике наименование и адрес оператора, а также e-mail для обращений. ИНН/ОГРН указывать — хорошая практика, но не требование",
    );
    assert.deepEqual(
      item?.norms.map((norm) => norm.label),
      ["152-ФЗ ст. 18.1 ч. 2", "152-ФЗ, п. 4 ч. 7 ст. 14", "149-ФЗ ст. 10 ч. 2"],
    );
    const lawHref = "href" in item.norms[1] ? item.norms[1].href : "";
    assert.equal(lawHref, "https://www.consultant.ru/document/cons_doc_LAW_61801/");
    assert.equal(safeHref(lawHref), lawHref);
    assert.equal(lawHref.includes("eeeebe22"), false);
    const dumped = JSON.stringify(sampleReport);
    assert.equal(dumped.includes("п. 3.1"), false);
    assert.equal(dumped.includes("Рекомендации РКН"), false);
    assert.equal(dumped.includes("cons_doc_LAW_221615"), false);
  });

  it("takes the footer operator name from operator_short_name", () => {
    const paragraph = footerParagraphs(false).find((line) => line.includes("частная компания"));
    assert.equal(
      paragraph,
      `${placeholders.operator_short_name} — частная компания. Сервис не является государственным, не связан с Роскомнадзором и иными государственными органами, не действует от их имени и не одобрен ими.`,
    );
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

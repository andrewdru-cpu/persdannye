import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flags } from "./flags.ts";
import { visibleFooterDocuments } from "./legal-nav.ts";
import { notApplicableItems } from "./not-applicable.ts";
import {
  CHECK_CLEAR_LINE,
  CONTACT_MASK,
  basisLabel,
  findingCountsAsRisk,
  findingsForClient,
  maskClientPii,
  presentCheckReport,
  scanHasRisks,
} from "../lib/check-report.ts";
import { publicCheckJob } from "../lib/parser-client.ts";
import { marketingConsentEnabled } from "../lib/runtime-flags.ts";
import type { CheckJob, Finding, Recommendation } from "../lib/types.ts";

const findings: Finding[] = [
  {
    rule_id: "P01",
    title: "Нет политики",
    fact: "Документ не найден. Письмо owner@site.ru в тексте.",
    severity: "critical",
    status: "fail",
    status_basis: "confirmed",
    fine: 150000,
    remediation: "Опубликуйте документ.",
    collects_pd: true,
  },
  {
    rule_id: "C02",
    title: "Cookie",
    fact: "Аналитика включается сразу.",
    severity: "high",
    status: "fail",
    status_basis: "likely",
    fine: null,
    remediation: "Ждите выбор человека.",
  },
  {
    rule_id: "F03",
    title: "Форма",
    fact: "Нет отдельной отметки.",
    severity: "high",
    status: "fail",
    status_basis: "interpretation",
    fine: null,
  },
  {
    rule_id: "I05",
    title: "Счётчик",
    fact: "Справочная строка.",
    severity: "info",
    status: "info",
    status_basis: "confirmed",
    fine: 50000,
  },
  {
    rule_id: "N06",
    title: "Блок закрыт",
    fact: "Страница не открылась.",
    severity: "medium",
    status: "not_checked",
    fine: 10000,
  },
  {
    rule_id: "X07",
    title: "Не про этот сайт",
    fact: "Правило не применяется.",
    severity: "low",
    status: "not_applicable",
    fine: 1000,
    collects_pd: false,
  },
  {
    rule_id: "U08",
    title: "Чужое основание",
    fact: "Основание вне списка.",
    severity: "low",
    status: "fail",
    status_basis: "needs_review",
    fine: null,
  },
];

const recommendations: Recommendation[] = [
  {
    id: "r-low",
    title: "Подпись",
    text: "Не копируйте ivan@example.ru",
    priority: "low",
    count: 2,
    evidence: [{ note: "Черновик: +7 (999) 111-22-33", selector: "form .hint", url: "https://example.com/form" }],
  },
  {
    id: "r-high",
    title: "Ссылка",
    text: "Ссылка в подвале.",
    priority: "high",
    count: 5,
    evidence: [{ note: CONTACT_MASK, selector: "footer", url: "https://example.com/" }],
  },
  {
    id: "r-unknown",
    title: "Вложение",
    text: "Файл не разобран.",
    priority: "urgent",
    count: 1,
  },
  {
    id: "r-med",
    title: "Категории",
    text: "Остальные cookie — по выбору.",
    priority: "medium",
    count: 3,
    evidence: [{ note: "owner@site.ru", selector: "a[href='mailto:owner@site.ru']" }],
  },
];

function view(showFines: boolean) {
  return presentCheckReport({ findings, recommendations }, { showFines });
}

describe("check report contract", () => {
  it("labels basis, hides not_applicable, and does not say нарушение", () => {
    const report = view(false);
    const byId = Object.fromEntries(report.findings.map((item) => [item.ruleId, item]));
    assert.equal(byId.P01?.basisLabel, null);
    assert.equal(byId.C02?.basisLabel, "вероятно");
    assert.equal(byId.F03?.basisLabel, "наше толкование");
    assert.equal(byId.U08?.basisLabel, "без уточнения");
    assert.equal(basisLabel("needs_review"), "без уточнения");
    assert.equal(byId.X07, undefined);
    assert.equal(byId.N06?.statusLabel, "не удалось проверить");
    assert.equal(byId.P01?.remediation, "Опубликуйте документ.");
    assert.equal(byId.I05?.informational, true);
    assert.equal(byId.I05?.fineLabel, null);
    const dumped = JSON.stringify(report);
    assert.equal(dumped.includes("нарушение"), false);
    assert.equal(dumped.includes("needs_review"), false);
    assert.equal(dumped.includes("collects_pd"), false);
    assert.equal(dumped.includes("\"count\""), false);
    assert.equal(CHECK_CLEAR_LINE.includes("нарушение"), false);
  });

  it("shows a numeric fine only when the fines flag is on and the row is not informational", () => {
    const hidden = view(false);
    const shown = view(true);
    assert.equal(JSON.stringify(hidden).includes("150"), false);
    assert.equal(JSON.stringify(hidden).includes("₽"), false);
    const hiddenById = Object.fromEntries(hidden.findings.map((item) => [item.ruleId, item]));
    const shownById = Object.fromEntries(shown.findings.map((item) => [item.ruleId, item]));
    const format = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
    assert.equal(hiddenById.P01?.fineLabel, null);
    assert.equal(hiddenById.C02?.fineLabel, null);
    assert.equal(shownById.P01?.fineLabel, format(150000));
    assert.equal(shownById.I05?.fineLabel, null);
    assert.equal(shownById.N06?.fineLabel, format(10000));
    assert.equal(shownById.X07, undefined);
  });

  it("sorts recommendations and masks contacts in text, note, and selector", () => {
    const report = view(false);
    assert.deepEqual(
      report.recommendations.map((item) => item.id),
      ["r-high", "r-med", "r-low", "r-unknown"],
    );
    const low = report.recommendations.find((item) => item.id === "r-low");
    const med = report.recommendations.find((item) => item.id === "r-med");
    const high = report.recommendations.find((item) => item.id === "r-high");
    assert.equal(low?.text.includes("ivan@example.ru"), false);
    assert.equal(low?.text.includes(CONTACT_MASK), true);
    assert.equal(low?.evidence[0]?.note, `Черновик: ${CONTACT_MASK}`);
    assert.equal(low?.evidence[0]?.href, "https://example.com/form");
    assert.equal(med?.evidence[0]?.note, CONTACT_MASK);
    assert.equal(med?.evidence[0]?.selector.includes("owner@site.ru"), false);
    assert.equal(high?.evidence[0]?.note, CONTACT_MASK);
    assert.equal(maskClientPii(CONTACT_MASK), CONTACT_MASK);
    assert.equal(maskClientPii("напишите на a@b.ru"), `напишите на ${CONTACT_MASK}`);
    assert.equal(maskClientPii("a@b.ru"), CONTACT_MASK);
  });

  it("does not treat info, not_checked, or not_applicable as a risk", () => {
    assert.equal(findingCountsAsRisk(findings[0]!), true);
    assert.equal(findingCountsAsRisk(findings[3]!), false);
    assert.equal(findingCountsAsRisk(findings[4]!), false);
    assert.equal(findingCountsAsRisk(findings[5]!), false);
    assert.equal(scanHasRisks(true, false, [findings[3]!, findings[5]!]), false);
    assert.equal(scanHasRisks(true, false, [findings[0]!]), true);
    assert.equal(scanHasRisks(false, false, [findings[0]!]), false);
  });

  it("strips collects_pd before the browser payload", () => {
    const stripped = findingsForClient(findings);
    assert.equal(stripped.some((item) => "collects_pd" in item), false);
    assert.equal(stripped[0]?.rule_id, "P01");
    const job = {
      id: "1",
      url: "https://example.com",
      domain: "example.com",
      phase: "done",
      phaseMessage: "готово",
      findings,
      recommendations,
      hasRisks: true,
      createdAt: "2026-10-15T00:00:00.000Z",
      updatedAt: "2026-10-15T00:00:00.000Z",
      mock: true,
      contact: { email: "hidden@example.com", consent: true },
    } satisfies CheckJob;
    const pub = publicCheckJob(job);
    assert.equal("contact" in pub, false);
    assert.equal(pub.findings.some((item) => "collects_pd" in item), false);
  });

  it("uses the clear line when every finding is hidden", () => {
    const report = presentCheckReport(
      { findings: [findings[5]!], recommendations: [] },
      { showFines: true },
    );
    assert.equal(report.findings.length, 0);
    assert.equal(report.clearLine, CHECK_CLEAR_LINE);
    assert.equal(JSON.stringify(report).includes("1000"), false);
  });
});

describe("checklist flags", () => {
  it("keeps legal pages, requisites, and the mailing checkbox off", () => {
    assert.equal(flags.show_requisites, false);
    assert.equal(flags.show_offer, false);
    assert.equal(flags.show_refund, false);
    assert.equal(flags.show_cookie_policy, false);
    assert.equal(flags.show_terms, false);
    assert.equal(flags.show_data_deletion, false);
    assert.equal(flags.show_marketing_consent, false);
    assert.equal(flags.show_fines, false);
    assert.equal(flags.show_prices, false);
    const hrefs = visibleFooterDocuments().map((item) => item.href);
    assert.deepEqual(hrefs, ["/privacy", "/applicability"]);
    const previous = process.env.VERCEL_ENV;
    const override = process.env.NEXT_PUBLIC_MARKETING_CONSENT;
    delete process.env.NEXT_PUBLIC_MARKETING_CONSENT;
    process.env.VERCEL_ENV = "preview";
    try {
      assert.equal(marketingConsentEnabled(), false);
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
      if (override === undefined) delete process.env.NEXT_PUBLIC_MARKETING_CONSENT;
      else process.env.NEXT_PUBLIC_MARKETING_CONSENT = override;
    }
  });

  it("marks checklist items 9, 16, and 17 as not applicable", () => {
    assert.deepEqual(
      notApplicableItems.map((item) => item.id),
      ["9", "16", "17"],
    );
    for (const item of notApplicableItems) {
      assert.equal(item.mark, "неприменимо");
      assert.equal(item.reason.length > 20, true);
    }
    const unsubscribe = notApplicableItems.find((item) => item.id === "17");
    assert.equal(unsubscribe?.reason.includes("/u/"), true);
    assert.equal(unsubscribe?.reason.includes("детей"), true);
    const commissions = notApplicableItems.find((item) => item.id === "9");
    assert.equal(commissions?.reason.includes("комисс"), true);
    const age = notApplicableItems.find((item) => item.id === "16");
    assert.equal(age?.reason.includes("детей"), true);
  });
});

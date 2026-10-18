import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer } from "../components/layout/Footer.tsx";
import { LeadForm } from "../components/landing/LeadForm.tsx";
import { PolicyLine, ReportConsentFields } from "../components/check/ReportConsentFields.tsx";
import DataDeletionPage, { metadata as dataDeletionMeta } from "../app/data-deletion/page.tsx";
import ConsentLeadPage, { metadata as consentLeadMeta } from "../app/consent-lead/page.tsx";
import ConsentMarketingPage, { metadata as consentMarketingMeta } from "../app/consent-marketing/page.tsx";
import ConsentPage, { metadata as consentMeta } from "../app/consent/page.tsx";
import CookiesPage, { metadata as cookiesMeta } from "../app/cookies/page.tsx";
import OfferPage, { metadata as offerMeta } from "../app/offer/page.tsx";
import PrivacyPage, { metadata as privacyMeta } from "../app/privacy/page.tsx";
import RefundPage, { metadata as refundMeta } from "../app/refund/page.tsx";
import TermsPage, { metadata as termsMeta } from "../app/terms/page.tsx";
import { flags } from "./flags.ts";
import { visibleFooterDocuments } from "./legal-nav.ts";
import { SITE_LEGAL_SUBJECTS_CLAUSE, siteLegalPrivacyMarkers } from "./site-legal.ts";
import { company } from "../lib/company.ts";

const noindex = { index: false, follow: false } as const;
const pendingText = "Текст не опубликован";

const cookieMarkers = [
  "Cookie — небольшие фрагменты данных",
  "Редакция от 21.09.2026",
] as const;

const termsMarkers = [
  "Настоящее соглашение является публичной офертой",
  "Редакция от 21.09.2026",
] as const;

const gatedHrefs = ["/cookies", "/terms", "/offer", "/refund", "/data-deletion"] as const;

function markup(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? "");
}

function withFlags(patch: Partial<typeof flags>, run: () => void) {
  const previous = { ...flags };
  Object.assign(flags, patch);
  try {
    run();
  } finally {
    Object.assign(flags, previous);
  }
}

function consentFields(showMarketing: boolean) {
  return markup(
    createElement(ReportConsentFields, {
      consent: false,
      onConsent: () => {},
      marketing: false,
      onMarketing: () => {},
      showMarketing,
    }),
  );
}

describe("legal pages rendered html", { concurrency: 1 }, () => {
  it("renders offer, refund, and data deletion as noindex stubs", () => {
    const pages = [
      { Page: OfferPage, metadata: offerMeta, title: "Оферта" },
      { Page: RefundPage, metadata: refundMeta, title: "Возврат" },
      { Page: DataDeletionPage, metadata: dataDeletionMeta, title: "Удаление данных" },
    ] as const;
    for (const item of pages) {
      assert.deepEqual(item.metadata.robots, noindex, item.title);
      const html = markup(createElement(item.Page));
      assert.equal(html.includes(pendingText), true, item.title);
      assert.equal(html.includes(item.title), true, item.title);
      assert.equal(html.includes(company.inn), false, item.title);
      assert.equal(html.includes(company.ogrn), false, item.title);
      assert.equal(hrefsOf(html).some((href) => gatedHrefs.includes(href as (typeof gatedHrefs)[number])), false, item.title);
    }
  });

  it("renders cookies and terms as noindex stubs without their document markers", () => {
    assert.deepEqual(cookiesMeta.robots, noindex);
    assert.deepEqual(termsMeta.robots, noindex);
    const cookies = markup(createElement(CookiesPage));
    const terms = markup(createElement(TermsPage));
    assert.equal(cookies.includes(pendingText), true);
    assert.equal(terms.includes(pendingText), true);
    assert.equal(cookies.includes("Политика cookie"), true);
    assert.equal(terms.includes("Пользовательское соглашение"), true);
    for (const marker of cookieMarkers) assert.equal(cookies.includes(marker), false, marker);
    for (const marker of termsMarkers) assert.equal(terms.includes(marker), false, marker);
    assert.equal(hrefsOf(cookies).includes("/cookies"), false);
    assert.equal(hrefsOf(terms).includes("/cookies"), false);
  });

  it("renders the cookie and terms documents when their flags are substituted on", () => {
    withFlags({ show_cookie_policy: true, show_terms: true }, () => {
      const cookies = markup(createElement(CookiesPage));
      const terms = markup(createElement(TermsPage));
      assert.equal(cookies.includes(pendingText), false);
      assert.equal(terms.includes(pendingText), false);
      for (const marker of cookieMarkers) assert.equal(cookies.includes(marker), true, marker);
      for (const marker of termsMarkers) assert.equal(terms.includes(marker), true, marker);
      assert.equal(hrefsOf(terms).includes("/cookies"), true);
      assert.equal(hrefsOf(terms).includes("/privacy"), true);
    });
    assert.equal(flags.show_cookie_policy, false);
    assert.equal(flags.show_terms, false);
  });

  it("keeps the 21.09 privacy policy and hides site-legal markers", () => {
    assert.equal(flags.show_site_legal, false);
    assert.equal(privacyMeta.robots, undefined);
    const html = markup(createElement(PrivacyPage));
    assert.equal(html.includes("Редакция от 21.09.2026"), true);
    assert.equal(html.includes("Настоящая Политика обработки персональных данных"), true);
    assert.equal(html.includes(pendingText), false);
    assert.equal(html.includes('href="/cookies"'), true);
    assert.equal(html.includes(SITE_LEGAL_SUBJECTS_CLAUSE), false);
    for (const marker of siteLegalPrivacyMarkers) {
      assert.equal(html.includes(marker), false, marker);
    }
    withFlags({ show_site_legal: true }, () => {
      const shown = markup(createElement(PrivacyPage));
      assert.equal(shown.includes(SITE_LEGAL_SUBJECTS_CLAUSE), true);
      assert.equal(shown.includes(pendingText), false);
      for (const marker of siteLegalPrivacyMarkers) {
        assert.equal(shown.includes(marker), false, marker);
      }
    });
    assert.equal(flags.show_site_legal, false);
  });

  it("renders the consent pages and the checkbox links", () => {
    const pages = [
      {
        Page: ConsentPage,
        metadata: consentMeta,
        marker: "Цель: проведение автоматической проверки указанного мной сайта",
      },
      {
        Page: ConsentLeadPage,
        metadata: consentLeadMeta,
        marker: "Цель: рассмотрение моей заявки",
      },
      {
        Page: ConsentMarketingPage,
        metadata: consentMarketingMeta,
        marker: "согласие на получение рекламных и информационных писем",
      },
    ] as const;
    for (const item of pages) {
      assert.equal(item.metadata.robots, undefined);
      const html = markup(createElement(item.Page));
      assert.equal(html.includes(item.marker), true, item.marker);
      assert.equal(html.includes(pendingText), false, item.marker);
      assert.equal(html.includes('href="/privacy"'), true, item.marker);
    }
    const hiddenMarketing = consentFields(false);
    assert.equal(hiddenMarketing.includes('href="/consent"'), true);
    assert.equal(hiddenMarketing.includes('href="/consent-marketing"'), false);
    const shownMarketing = consentFields(true);
    assert.equal(shownMarketing.includes('href="/consent"'), true);
    assert.equal(shownMarketing.includes('href="/consent-marketing"'), true);
    const policy = markup(createElement(PolicyLine));
    assert.equal(policy.includes('href="/privacy"'), true);
    const lead = markup(createElement(LeadForm));
    assert.equal(lead.includes('href="/consent-lead"'), true);
    assert.equal(lead.includes('href="/privacy"'), true);
    assert.equal(lead.includes('href="/consent-marketing"'), false);
  });

  it("hides footer links and requisites for disabled documents", () => {
    const previous = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    try {
      const html = markup(createElement(Footer));
      const links = hrefsOf(html);
      for (const href of gatedHrefs) {
        assert.equal(links.includes(href), false, href);
      }
      assert.equal(links.includes("/privacy"), true);
      assert.equal(links.includes("/applicability"), true);
      assert.equal(html.includes(company.inn), false);
      assert.equal(html.includes(company.ogrn), false);
      assert.equal(html.includes(company.address), false);
      assert.equal(html.includes(company.phone), false);
      assert.equal(html.includes(company.legalName), false);
      assert.equal(html.includes("Реквизиты не опубликованы"), true);
      assert.deepEqual(visibleFooterDocuments().map((item) => item.href), ["/privacy", "/applicability"]);
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });

  it("shows footer links and requisites when those flags are substituted on", () => {
    withFlags(
      {
        show_cookie_policy: true,
        show_terms: true,
        show_offer: true,
        show_refund: true,
        show_data_deletion: true,
        show_requisites: true,
      },
      () => {
        const html = markup(createElement(Footer));
        const links = hrefsOf(html);
        for (const href of [...gatedHrefs, "/privacy"]) {
          assert.equal(links.includes(href), true, href);
        }
        assert.equal(html.includes("Политика cookie"), true);
        assert.equal(html.includes("Пользовательское соглашение"), true);
        assert.equal(html.includes("Оферта"), true);
        assert.equal(html.includes("Возврат"), true);
        assert.equal(html.includes("Порядок удаления данных"), true);
        assert.equal(html.includes(company.inn), true);
        assert.equal(html.includes(company.legalName), true);
        assert.equal(html.includes(company.phone), true);
        assert.equal(html.includes("Реквизиты не опубликованы"), false);
      },
    );
    assert.equal(flags.show_offer, false);
    assert.equal(flags.show_requisites, false);
    assert.equal(flags.show_cookie_policy, false);
    assert.equal(flags.show_terms, false);
    assert.equal(flags.show_refund, false);
    assert.equal(flags.show_data_deletion, false);
  });

  it("keeps gated document links out of the rendered pages while the flags are off", () => {
    const found = new Map<string, string[]>();
    const pages = [
      ["app/privacy/page.tsx", createElement(PrivacyPage)],
      ["app/cookies/page.tsx", createElement(CookiesPage)],
      ["app/terms/page.tsx", createElement(TermsPage)],
      ["app/offer/page.tsx", createElement(OfferPage)],
      ["app/refund/page.tsx", createElement(RefundPage)],
      ["app/data-deletion/page.tsx", createElement(DataDeletionPage)],
      ["app/consent/page.tsx", createElement(ConsentPage)],
      ["app/consent-lead/page.tsx", createElement(ConsentLeadPage)],
      ["app/consent-marketing/page.tsx", createElement(ConsentMarketingPage)],
      ["components/layout/Footer.tsx", createElement(Footer)],
      ["components/landing/LeadForm.tsx", createElement(LeadForm)],
    ] as const;
    for (const [name, node] of pages) {
      const hrefs = hrefsOf(markup(node)).filter((href) =>
        gatedHrefs.includes(href as (typeof gatedHrefs)[number]),
      );
      if (hrefs.length > 0) found.set(name, hrefs);
    }
    assert.deepEqual(Object.fromEntries(found), {
      "app/privacy/page.tsx": ["/cookies"],
    });
  });
});

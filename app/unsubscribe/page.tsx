import type { Metadata } from "next";
import Link from "next/link";
import { legalContent } from "@/content/legal";
import { company } from "@/lib/company";
import { SUBJECT_PAGE_REFERRER, SUBJECT_PAGE_ROBOTS } from "@/lib/subject-request";

export const metadata: Metadata = {
  title: legalContent.unsubscribeTitle,
  robots: SUBJECT_PAGE_ROBOTS,
  referrer: SUBJECT_PAGE_REFERRER,
};

/**
 * Static note. One-click unsubscribe is the link in the email and is served
 * by the parser under /u/ on the API host. This page does not read a query
 * string and does not proxy that path.
 */
export default function UnsubscribePage() {
  return (
    <article
      className="mx-auto max-w-xl px-4 py-14 md:px-6 md:py-20"
      data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
    >
      <h1 className="font-display text-4xl font-semibold text-white">{legalContent.unsubscribeTitle}</h1>
      <p className="mt-4 text-sm leading-relaxed text-white/70">{legalContent.unsubscribeLead}</p>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{legalContent.unsubscribeEmailLink}</p>
      <p className="mt-6 text-sm leading-relaxed text-white/70">{legalContent.unsubscribeSubjectContact}</p>
      <p className="mt-3 text-sm leading-relaxed">
        <Link href="/privacy/request" className="text-amber-200 hover:underline">
          {legalContent.privacyRequestTitle}
        </Link>
      </p>
      <p className="mt-2 text-sm text-white/70">
        <a className="text-amber-200 hover:underline" href={`mailto:${company.dpoEmail}`}>
          {company.dpoEmail}
        </a>
      </p>
    </article>
  );
}

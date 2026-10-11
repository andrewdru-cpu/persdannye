import type { Metadata } from "next";
import { PrivacyRequestForm } from "@/components/subject/PrivacyRequestForm";
import { legalContent } from "@/content/legal";
import { SUBJECT_PAGE_REFERRER, SUBJECT_PAGE_ROBOTS } from "@/lib/subject-request";

export const metadata: Metadata = {
  title: legalContent.privacyRequestTitle,
  robots: SUBJECT_PAGE_ROBOTS,
  referrer: SUBJECT_PAGE_REFERRER,
};

export default function PrivacyRequestPage() {
  return (
    <article className="mx-auto max-w-xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="font-display text-4xl font-semibold text-white">{legalContent.privacyRequestTitle}</h1>
      <p className="mt-4 text-sm leading-relaxed text-white/70">{legalContent.privacyRequestLead}</p>
      <p
        className="mt-3 text-sm leading-relaxed text-white/80"
        data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
      >
        {legalContent.privacyEmailReply}
      </p>
      <PrivacyRequestForm />
    </article>
  );
}

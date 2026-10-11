import type { Metadata } from "next";
import { UnsubscribeConfirm } from "@/components/subject/UnsubscribeConfirm";
import { legalContent } from "@/content/legal";
import { SUBJECT_PAGE_REFERRER, SUBJECT_PAGE_ROBOTS } from "@/lib/subject-request";

export const metadata: Metadata = {
  title: legalContent.unsubscribeTitle,
  robots: SUBJECT_PAGE_ROBOTS,
  referrer: SUBJECT_PAGE_REFERRER,
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.t) ? query.t[0] : query.t;
  const token = typeof raw === "string" ? raw.trim() : "";

  return (
    <article className="mx-auto max-w-xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="font-display text-4xl font-semibold text-white">{legalContent.unsubscribeTitle}</h1>
      <div className="mt-6">
        <UnsubscribeConfirm token={token} />
      </div>
    </article>
  );
}

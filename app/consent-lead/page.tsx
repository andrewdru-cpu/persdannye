import type { Metadata } from "next";
import Link from "next/link";
import { leadConsent } from "@/content/consents";
import { fillPlaceholders } from "@/content/placeholders";
import { LegalPending } from "@/components/legal/LegalPending";
import { legalPublication, unpublishedRobots } from "@/lib/legal-publication";
import { showPlaceholderTodos } from "@/lib/runtime-flags";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных (заявка)",
  robots: unpublishedRobots(),
};

export default function LeadConsentPage() {
  if (legalPublication() === "pending") {
    return <LegalPending title="Согласие на обработку персональных данных (заявка)" />;
  }
  return <LeadConsentDocument />;
}

function LeadConsentDocument() {
  const todos = showPlaceholderTodos();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{leadConsent.title}</h1>
      {leadConsent.paragraphs.map((paragraph, index) => (
        <p key={index} className="mt-4 text-sm leading-relaxed text-white/75">
          {fillPlaceholders(paragraph, todos)}
        </p>
      ))}
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/75">
        {leadConsent.points.map((point, index) => (
          <li key={index}>{fillPlaceholders(point, todos)}</li>
        ))}
      </ol>
      <p className="mt-6 text-sm">
        <Link href="/privacy" className="text-amber-300 hover:underline">
          Политика обработки персональных данных
        </Link>
      </p>
    </article>
  );
}

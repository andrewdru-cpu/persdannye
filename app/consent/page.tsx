import type { Metadata } from "next";
import Link from "next/link";
import { reportConsent } from "@/content/consents";
import { fillPlaceholders } from "@/content/placeholders";
import { showPlaceholderTodos } from "@/lib/runtime-flags";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
};

export default function ReportConsentPage() {
  const todos = showPlaceholderTodos();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{reportConsent.title}</h1>
      {reportConsent.paragraphs.map((paragraph, index) => (
        <p key={index} className="mt-4 text-sm leading-relaxed text-white/75">
          {fillPlaceholders(paragraph, todos)}
        </p>
      ))}
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/75">
        {reportConsent.points.map((point, index) => (
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

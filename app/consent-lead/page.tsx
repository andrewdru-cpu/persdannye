import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LegalPending } from "@/components/legal/LegalPending";
import { flags } from "@/content/flags";
import { leadConsent } from "@/content/consents";
import { fillPlaceholders } from "@/content/placeholders";
import { showPlaceholderTodos } from "@/lib/runtime-flags";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных (заявка)",
  robots: flags.show_site_legal ? undefined : { index: false, follow: false },
};

const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

function ConsentText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(linkPattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const href = match[2];
    const label = match[1];
    if (href.startsWith("/") || href.startsWith("https://")) {
      nodes.push(
        <Link key={`${start}-${href}`} href={href} className="text-amber-300 hover:underline">
          {label}
        </Link>
      );
    } else {
      nodes.push(label);
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export default function LeadConsentPage() {
  if (!flags.show_site_legal) {
    return <LegalPending title="Согласие на обработку персональных данных (заявка)" />;
  }
  const todos = showPlaceholderTodos();
  const fill = (value: string) => fillPlaceholders(value, todos, true);
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{leadConsent.title}</h1>
      {leadConsent.paragraphs.map((paragraph, index) => (
        <p key={index} className="mt-4 text-sm leading-relaxed text-white/75">
          <ConsentText text={fill(paragraph)} />
        </p>
      ))}
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/75">
        {leadConsent.points.map((point, index) => (
          <li key={index}>
            <ConsentText text={fill(point)} />
          </li>
        ))}
      </ol>
    </article>
  );
}

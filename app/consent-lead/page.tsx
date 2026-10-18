import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LegalPending } from "@/components/legal/LegalPending";
import { flags } from "@/content/flags";
import { leadConsentDocument, publishLeadConsent } from "@/lib/lead-consent";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных (заявка)",
  robots: flags.show_site_legal ? undefined : { index: false, follow: false },
};

const inlinePattern = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;

function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    if (match[2]) {
      nodes.push(<strong key={start}>{match[2]}</strong>);
    } else {
      const label = match[4];
      const href = match[5];
      if (href.startsWith("/") || href.startsWith("https://")) {
        nodes.push(
          <Link key={start} href={href} className="text-amber-300 hover:underline">
            {label}
          </Link>
        );
      } else {
        nodes.push(label);
      }
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export default function LeadConsentPage() {
  const text = publishLeadConsent(flags.show_site_legal);
  if (!text) {
    return <LegalPending title="Согласие на обработку персональных данных (заявка)" />;
  }
  const blocks = leadConsentDocument(text);
  const title =
    blocks.find((block) => block.type === "title")?.text ??
    "Согласие на обработку персональных данных (заявка)";
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{title}</h1>
      {blocks
        .filter((block) => block.type === "paragraph")
        .map((block) => (
          <p key={block.text} className="mt-4 text-sm leading-relaxed text-white/75">
            <Inline text={block.text} />
          </p>
        ))}
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/75">
        {blocks
          .filter((block) => block.type === "point")
          .map((block) => (
            <li key={block.text}>
              <Inline text={block.text} />
            </li>
          ))}
      </ol>
    </article>
  );
}

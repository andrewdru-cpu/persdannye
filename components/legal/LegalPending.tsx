import { LEGAL_PENDING_TEXT } from "@/content/legal-publication";

/** Заглушка, пока юрист не отдал текст. Это не юридическая формулировка. */
export function LegalPending({ title }: { title: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-white/80">{LEGAL_PENDING_TEXT}</p>
    </article>
  );
}

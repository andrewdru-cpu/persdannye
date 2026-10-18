import type { LegalDocument } from "@/content/legal-documents";

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{document.title}</h1>
      <p className="mt-2 text-sm text-white/80">{document.edition}</p>
      {document.blocks.map((block) => (
        <p key={block} className="mt-4 text-sm leading-relaxed text-white/80">
          {block}
        </p>
      ))}
    </article>
  );
}

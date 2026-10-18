import type { LegalDocument } from "@/content/legal-documents";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { LegalPending } from "@/components/legal/LegalPending";

/** Та же развилка, что у /terms и /cookies: без флага или без текста — заглушка, не 404. */
export function GatedLegalPage({
  show,
  document,
  title,
}: {
  show: boolean;
  document: LegalDocument | null;
  title: string;
}) {
  if (!show || !document) {
    return <LegalPending title={title} />;
  }
  return <LegalDocumentView document={document} />;
}

import type { Metadata } from "next";
import { flags } from "@/content/flags";
import { dataDeletionDocument } from "@/content/legal-documents";
import { legalRobots } from "@/lib/legal-publication";
import { GatedLegalPage } from "@/components/legal/GatedLegalPage";

export const metadata: Metadata = {
  title: "Удаление данных",
  robots: legalRobots(flags.show_data_deletion, dataDeletionDocument),
};

/** Порядок удаления данных ждёт юриста. Страница не выдумывает процедуру. */
export default function DataDeletionPage() {
  return (
    <GatedLegalPage
      show={flags.show_data_deletion}
      document={dataDeletionDocument}
      title="Удаление данных"
    />
  );
}

import type { Metadata } from "next";
import { LegalPending } from "@/components/legal/LegalPending";

export const metadata: Metadata = {
  title: "Удаление данных",
  robots: { index: false, follow: false },
};

/** Порядок удаления данных ждёт юриста. Страница не выдумывает процедуру. */
export default function DataDeletionPage() {
  return <LegalPending title="Удаление данных" />;
}
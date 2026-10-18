import type { Metadata } from "next";
import { flags } from "@/content/flags";
import { refundDocument } from "@/content/legal-documents";
import { legalRobots } from "@/content/legal-publication";
import { GatedLegalPage } from "@/components/legal/GatedLegalPage";

export const metadata: Metadata = {
  title: "Возврат",
  robots: legalRobots(flags.show_refund, refundDocument),
};

/** Текст о возврате ждёт юриста. Страница не выдумывает условия. */
export default function RefundPage() {
  return <GatedLegalPage show={flags.show_refund} document={refundDocument} title="Возврат" />;
}

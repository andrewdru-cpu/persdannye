import type { Metadata } from "next";
import { flags } from "@/content/flags";
import { offerDocument } from "@/content/legal-documents";
import { legalRobots } from "@/content/legal-publication";
import { GatedLegalPage } from "@/components/legal/GatedLegalPage";

export const metadata: Metadata = {
  title: "Оферта",
  robots: legalRobots(flags.show_offer, offerDocument),
};

/** Текст оферты ждёт юриста. Страница не выдумывает условия. */
export default function OfferPage() {
  return <GatedLegalPage show={flags.show_offer} document={offerDocument} title="Оферта" />;
}

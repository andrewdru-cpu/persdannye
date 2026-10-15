import type { Metadata } from "next";
import { LegalPending } from "@/components/legal/LegalPending";

export const metadata: Metadata = { title: "Оферта", robots: { index: false, follow: false } };

/** Текст оферты ждёт юриста. Страница не выдумывает условия. */
export default function OfferPage() {
  return <LegalPending title="Оферта" />;
}

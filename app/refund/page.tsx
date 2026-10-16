import type { Metadata } from "next";
import { LegalPending } from "@/components/legal/LegalPending";

export const metadata: Metadata = { title: "Возврат", robots: { index: false, follow: false } };

/** Текст о возврате ждёт юриста. Страница не выдумывает условия. */
export default function RefundPage() {
  return <LegalPending title="Возврат" />;
}

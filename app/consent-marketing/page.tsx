import type { Metadata } from "next";
import { LegalPending } from "@/components/legal/LegalPending";
import { flags } from "@/content/flags";

const title = "Согласие на получение рекламных и информационных рассылок";

export const metadata: Metadata = {
  title,
  robots: flags.show_site_legal ? undefined : { index: false, follow: false },
};

export default function MarketingConsentPage() {
  if (!flags.show_site_legal) {
    return <LegalPending title={title} />;
  }
  return <LegalPending title={title} />;
}

import type { Metadata } from "next";
import { LegalPending } from "@/components/legal/LegalPending";
import { MarketingConsentArticle } from "@/components/legal/MarketingConsentArticle";
import { flags } from "@/content/flags";
import { publishMarketingConsent, readMarketingConsentTemplate } from "@/content/marketing-consent";

const title = "Согласие на получение рекламных и информационных рассылок";

export const metadata: Metadata = {
  title,
  robots: flags.show_site_legal ? undefined : { index: false, follow: false },
};

export default function MarketingConsentPage() {
  if (!flags.show_site_legal) {
    return <LegalPending title={title} />;
  }
  return <MarketingConsentArticle text={publishMarketingConsent(readMarketingConsentTemplate())} />;
}

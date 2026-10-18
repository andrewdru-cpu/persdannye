import { renderMarketingConsentHtml } from "@/content/marketing-consent";

export function MarketingConsentArticle({ text }: { text: string }) {
  return (
    <article
      className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20"
      dangerouslySetInnerHTML={{ __html: renderMarketingConsentHtml(text) }}
    />
  );
}

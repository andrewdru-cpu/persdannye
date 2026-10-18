import { flags } from "../content/flags";

/** Превью Vercel. В проде оба значения false, пока их явно не включат. */
export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/**
 * Resolved `show_marketing_consent`. Preview does not turn the checkbox on by itself.
 * `NEXT_PUBLIC_MARKETING_CONSENT=true|false` overrides the flag only.
 */
export function marketingConsentFlag(): boolean {
  const override = process.env.NEXT_PUBLIC_MARKETING_CONSENT;
  if (override === "true") return true;
  if (override === "false") return false;
  return flags.show_marketing_consent;
}

/**
 * Marketing checkbox and `marketing_consent` require both flags.
 * Either one off: no checkbox, and the field is not sent.
 */
export function marketingConsentEnabled(
  showSiteLegal: boolean = flags.show_site_legal,
  showMarketingConsent: boolean = marketingConsentFlag()
): boolean {
  return showSiteLegal === true && showMarketingConsent === true;
}

export function showPlaceholderTodos(): boolean {
  return isPreviewDeployment();
}

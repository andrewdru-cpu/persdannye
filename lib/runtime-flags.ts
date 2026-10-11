import { flags } from "@/content/flags";

/** Превью Vercel. В проде оба значения false, пока их явно не включат. */
export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/**
 * Чекбокс рекламной рассылки. В контенте флаг выключен.
 * На превью включён через VERCEL_ENV, либо через NEXT_PUBLIC_MARKETING_CONSENT.
 */
export function marketingConsentEnabled(): boolean {
  const override = process.env.NEXT_PUBLIC_MARKETING_CONSENT;
  if (override === "true") return true;
  if (override === "false") return false;
  return isPreviewDeployment() || flags.show_marketing_consent;
}

export function showPlaceholderTodos(): boolean {
  return isPreviewDeployment();
}

import { flags } from "../content/flags";

/** Превью Vercel. В проде оба значения false, пока их явно не включат. */
export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/**
 * Чекбокс рекламной рассылки. Рассылки на сайте нет, поэтому превью его само не включает.
 * Только явный флаг или NEXT_PUBLIC_MARKETING_CONSENT=true.
 */
export function marketingConsentEnabled(): boolean {
  const override = process.env.NEXT_PUBLIC_MARKETING_CONSENT;
  if (override === "true") return true;
  if (override === "false") return false;
  return flags.show_marketing_consent;
}

export function showPlaceholderTodos(): boolean {
  return isPreviewDeployment();
}

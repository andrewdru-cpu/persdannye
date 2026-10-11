/**
 * Client and server read this at call time.
 * Next inlines NEXT_PUBLIC_* into the browser bundle at build, so switching
 * mode on Vercel requires a new deployment.
 */

export type FormsMode = "bff" | "direct";

export function getFormsMode(): FormsMode {
  return process.env.NEXT_PUBLIC_FORMS_MODE === "direct" ? "direct" : "bff";
}

export function isDirectForms(): boolean {
  return getFormsMode() === "direct";
}

/** Public parser origin, no trailing slash. Null when unset or not http(s). */
export function getPublicApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_PUBLIC_API_BASE?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/$/, "");
  try {
    const url = new URL(base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return base;
  } catch {
    return null;
  }
}

export function getSmartCaptchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_SMARTCAPTCHA_SITEKEY?.trim() || "";
}

/** Fine amounts stay hidden unless this build flag is exactly "true". */
export function showFineAmounts(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_FINES === "true";
}

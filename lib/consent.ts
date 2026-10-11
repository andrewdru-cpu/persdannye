/** Version of the URL-check contact consent text shown next to the checkbox. */
export const CONSENT_TEXT_VERSION = "2026-10-11";

/** Version of the lead-form consent (8.1-lead), dated 11.10.2026. */
export const LEAD_CONSENT_TEXT_VERSION = "2026-10-11-lead";

export class ScanConsentRequiredError extends Error {
  constructor() {
    super("Нужно согласие на обработку персональных данных");
    this.name = "ScanConsentRequiredError";
  }
}

export function isScanConsentRequiredError(err: unknown): err is ScanConsentRequiredError {
  return err instanceof ScanConsentRequiredError || (err instanceof Error && err.name === "ScanConsentRequiredError");
}

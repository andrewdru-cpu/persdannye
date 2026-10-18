/** Version of the URL-check contact consent text shown next to the checkbox. */
export const CONSENT_TEXT_VERSION = "2026-10-11";

/** Version of the lead-form consent (8.1-lead), dated 11.10.2026. */
export const LEAD_CONSENT_TEXT_VERSION = "2026-10-11-lead";

/**
 * Version of the mailing-consent checkbox text.
 * Separate from the URL-check consent. The parser stores this in
 * marketing_consent_text_version, which is at most 32 characters.
 * "2026-10-18-marketing" is 20 characters.
 */
export const MARKETING_CONSENT_TEXT_VERSION = "2026-10-18-marketing";

/** Fields the parser expects for mailing consent. It sets marketing_consent_at itself. */
export function marketingConsentForParser(consented: boolean): {
  marketing_consent: boolean;
  marketing_consent_text_version?: string;
} {
  if (consented) {
    return {
      marketing_consent: true,
      marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION,
    };
  }
  return { marketing_consent: false };
}

export class ScanConsentRequiredError extends Error {
  constructor() {
    super("Нужно согласие на обработку персональных данных");
    this.name = "ScanConsentRequiredError";
  }
}

export function isScanConsentRequiredError(err: unknown): err is ScanConsentRequiredError {
  return err instanceof ScanConsentRequiredError || (err instanceof Error && err.name === "ScanConsentRequiredError");
}

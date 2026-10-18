import { CONSENT_TEXT_VERSION } from "../content/consent";

export { CONSENT_POLICY_LABEL, CONSENT_TEXT, CONSENT_TEXT_VERSION } from "../content/consent";

/**
 * BFF lead checkbox (`POST /api/leads`). Same version as the URL-check consent.
 * Direct `POST /public/lead` uses DIRECT_LEAD_CONSENT_TEXT_VERSION instead.
 */
export const LEAD_CONSENT_TEXT_VERSION = CONSENT_TEXT_VERSION;

/** File name is the contract version plus `.md`. */
export function consentVersionFromFile(fileName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(fileName)) {
    throw new Error(`consent file name is not a version: ${fileName}`);
  }
  return fileName.slice(0, -".md".length);
}

/** Canonical lead consent. Direct `text_version` is this name without `.md`. */
export const DIRECT_LEAD_CONSENT_FILE = "2026-10-11-lead.md";

/** Parser accepts only this version on direct `POST /public/lead`. */
export const DIRECT_LEAD_CONSENT_TEXT_VERSION = consentVersionFromFile(DIRECT_LEAD_CONSENT_FILE);

/** Canonical marketing consent. The file arrives in a separate PR. */
export const DIRECT_MARKETING_CONSENT_FILE = "2026-10-18-marketing.md";

/**
 * Version of the mailing-consent checkbox text on the BFF path.
 * Separate from the URL-check consent. The parser stores this in
 * marketing_consent_text_version, which is at most 32 characters.
 * "2026-10-18-marketing" is 20 characters.
 */
export const MARKETING_CONSENT_TEXT_VERSION = "2026-10-18-marketing";

/**
 * Direct `POST /public/lead` marketing version. Kept separate from
 * MARKETING_CONSENT_TEXT_VERSION so the BFF path can change on its own.
 */
export const DIRECT_MARKETING_CONSENT_TEXT_VERSION = consentVersionFromFile(DIRECT_MARKETING_CONSENT_FILE);

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

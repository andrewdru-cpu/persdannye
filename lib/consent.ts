import { CONSENT_TEXT_VERSION } from "../content/consent";

export { CONSENT_POLICY_LABEL, CONSENT_TEXT, CONSENT_TEXT_VERSION } from "../content/consent";

/** Lead-form checkbox uses the same versioned sentence. */
export const LEAD_CONSENT_TEXT_VERSION = CONSENT_TEXT_VERSION;

export class ScanConsentRequiredError extends Error {
  constructor() {
    super("Нужно согласие на обработку персональных данных");
    this.name = "ScanConsentRequiredError";
  }
}

export function isScanConsentRequiredError(err: unknown): err is ScanConsentRequiredError {
  return err instanceof ScanConsentRequiredError || (err instanceof Error && err.name === "ScanConsentRequiredError");
}

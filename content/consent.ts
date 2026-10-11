/**
 * Consent sentence and the version the site sends to the parser.
 * CONSENT_TEXT_VERSION is the value from persdannye#4. Do not change it
 * here without adding the new string to the parser allowlist.
 * Callers must not substitute another version.
 */
export const CONSENT_TEXT_VERSION = "2026-10-11";

/** Linked phrase inside CONSENT_TEXT. It is part of the versioned sentence. */
export const CONSENT_POLICY_LABEL = "Политикой обработки персональных данных";

export const CONSENT_TEXT =
  "Я даю согласие на обработку персональных данных в соответствии с Политикой обработки персональных данных";

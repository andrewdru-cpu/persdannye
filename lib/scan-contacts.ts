/**
 * Contacts typed next to a URL check. They are forwarded to the parser
 * in the create-scan request and are never written to disk or /tmp.
 */

import type { ScanContact } from "./types";
import { CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "./consent";

export function normalizeScanContact(
  input?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    consent?: boolean | null;
    consent_text_version?: string | null;
    marketing_consent?: boolean | null;
    marketing_consent_text_version?: string | null;
  } | null
): ScanContact | null {
  if (!input) return null;
  const name = input.name?.trim() || undefined;
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  if (!name && !email && !phone) return null;
  const contact: ScanContact = {
    name,
    email,
    phone,
    source: "landing",
  };
  if (input.consent === true) {
    contact.consent = true;
    contact.consent_text_version = input.consent_text_version?.trim() || CONSENT_TEXT_VERSION;
  }
  if (input.marketing_consent === true) {
    contact.marketing_consent = true;
    contact.marketing_consent_text_version =
      input.marketing_consent_text_version?.trim() || MARKETING_CONSENT_TEXT_VERSION;
  }
  return contact;
}

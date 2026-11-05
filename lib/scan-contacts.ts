/**
 * Нормализация контактов скана в памяти запроса.
 * На диск сайта контакты не пишутся: их хранит парсер.
 */

import type { ScanContact } from "./types";
import { CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "./consent";

export function hasScanContact(contact?: ScanContact | null): boolean {
  return Boolean(contact && (contact.name || contact.email || contact.phone));
}

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

export function mergeScanContact(
  primary?: ScanContact | null,
  fallback?: ScanContact | null
): ScanContact | null {
  if (!hasScanContact(primary) && !hasScanContact(fallback)) return null;
  const consent = primary?.consent === true || fallback?.consent === true;
  const marketing = primary?.marketing_consent === true || fallback?.marketing_consent === true;
  return {
    name: primary?.name || fallback?.name,
    email: primary?.email || fallback?.email,
    phone: primary?.phone || fallback?.phone,
    source: primary?.source || fallback?.source || "landing",
    ...(consent
      ? {
          consent: true as const,
          consent_text_version:
            primary?.consent_text_version || fallback?.consent_text_version || CONSENT_TEXT_VERSION,
        }
      : {}),
    ...(marketing
      ? {
          marketing_consent: true as const,
          marketing_consent_text_version:
            primary?.marketing_consent_text_version ||
            fallback?.marketing_consent_text_version ||
            MARKETING_CONSENT_TEXT_VERSION,
        }
      : {}),
  };
}


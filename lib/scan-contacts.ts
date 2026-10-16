/**
 * Contacts typed next to the URL check, so a finished scan can alert
 * the manager even if the visitor has not submitted the full lead form.
 * Best-effort file store: a write failure must not fail the scan.
 */

import { promises as fs } from "fs";
import path from "path";
import type { ScanContact } from "./types";
import { dataFilePath } from "./data-dir";
import { CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "./consent";

const DATA_PATH = dataFilePath("scan-contacts.json");

type Store = Record<string, ScanContact & { url?: string; savedAt?: string }>;

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

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveScanContact(
  id: string,
  url: string,
  contact: ScanContact
): Promise<void> {
  if (!hasScanContact(contact)) return;
  const store = await readStore();
  store[id] = {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    source: "landing",
    ...(contact.consent === true
      ? {
          consent: true as const,
          consent_text_version: contact.consent_text_version || CONSENT_TEXT_VERSION,
        }
      : {}),
    ...(contact.marketing_consent === true
      ? {
          marketing_consent: true as const,
          marketing_consent_text_version:
            contact.marketing_consent_text_version || MARKETING_CONSENT_TEXT_VERSION,
        }
      : {}),
    url,
    savedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export async function findScanContact(id?: string): Promise<ScanContact | null> {
  if (!id) return null;
  const store = await readStore();
  const hit = store[id];
  return hit && hasScanContact(hit) ? hit : null;
}

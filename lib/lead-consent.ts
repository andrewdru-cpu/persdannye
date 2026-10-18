import { readFileSync } from "node:fs";
import path from "node:path";
import { placeholders } from "../content/placeholders";
import { company } from "./company";

export const LEAD_CONSENT_PATH = path.join(process.cwd(), "content/consents/lead-2026-10-11.md");

const token = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

export class UnresolvedConsentError extends Error {
  keys: string[];

  constructor(keys: string[]) {
    super(`lead consent placeholders unresolved: ${keys.join(", ")}`);
    this.name = "UnresolvedConsentError";
    this.keys = keys;
  }
}

export function readLeadConsentSource(file = LEAD_CONSENT_PATH): string {
  return readFileSync(file, "utf8");
}

export type LeadConsentBlock =
  | { type: "title"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "point"; text: string };

/** Splits the approved markdown into a title, intro, and numbered points. */
export function leadConsentDocument(source: string): LeadConsentBlock[] {
  const blocks: LeadConsentBlock[] = [];
  const chunks = source.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      const text = line.trim();
      if (!text) continue;
      const numbered = text.match(/^\d+\.\s+(.*)$/);
      if (numbered) {
        blocks.push({ type: "point", text: numbered[1] });
        continue;
      }
      const title = text.match(/^\*\*(.+)\*\*$/);
      if (title && blocks.length === 0) {
        blocks.push({ type: "title", text: title[1] });
        continue;
      }
      blocks.push({ type: "paragraph", text });
    }
  }
  return blocks;
}

/** Values the published page may substitute. Empty strings are not values. */
export function leadConsentProductionValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(placeholders)) {
    if (value.trim()) values[key] = value;
  }
  const email = company.privacy_contact_email.trim();
  if (email) values.privacy_contact_email = email;
  return values;
}

/**
 * Fills the approved lead consent. Any remaining `{{` fails the build:
 * the page calls this when `show_site_legal` is on.
 */
export function renderLeadConsent(source: string, values: Record<string, string>): string {
  const missing = new Set<string>();
  const rendered = source.replace(token, (match, key: string) => {
    const value = values[key];
    if (typeof value !== "string" || !value.trim() || value.includes("{{")) {
      missing.add(key);
      return match;
    }
    return value;
  });
  if (missing.size > 0 || rendered.includes("{{")) {
    throw new UnresolvedConsentError([...missing]);
  }
  return rendered;
}

/** `null` while the legal flag is off. On, the unresolved-placeholder guard runs. */
export function publishLeadConsent(showSiteLegal: boolean, source?: string): string | null {
  if (!showSiteLegal) return null;
  const text = source ?? readFileSync(LEAD_CONSENT_PATH, "utf8");
  return renderLeadConsent(text, leadConsentProductionValues());
}

import { LEAD_CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "./consent";

/** Parser contract v1.1. Direct mode adds smart_token itself; the BFF never does. */
export const PUBLIC_LEAD_PATH = "/public/lead";
export const PUBLIC_LEAD_MAX_BYTES = 16 * 1024;

const IDEMPOTENCY_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIdempotencyKey(value: string | null): value is string {
  return typeof value === "string" && IDEMPOTENCY_KEY.test(value);
}

export function exceedsPublicLeadBytes(value: string): boolean {
  return Buffer.byteLength(value, "utf8") > PUBLIC_LEAD_MAX_BYTES;
}

export type PublicLeadInput = {
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  checkId?: string;
  message?: string;
  source?: string;
  marketingConsent?: boolean;
};

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * JSON body for POST /public/lead. Unknown keys are not copied.
 * marketing_consent is present only when an email is sent and the checkbox is on.
 */
export function buildPublicLeadBody(input: PublicLeadInput): Record<string, unknown> {
  const email = filled(input.email);
  const phone = filled(input.phone);
  const body: Record<string, unknown> = {
    name: input.name,
    consent: { accepted: true, text_version: LEAD_CONSENT_TEXT_VERSION },
  };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  const url = filled(input.url);
  const checkId = filled(input.checkId);
  const message = filled(input.message);
  const source = filled(input.source);
  if (url) body.url = url;
  if (checkId) body.check_id = checkId;
  if (message) body.message = message;
  if (source) body.source = source;
  if (email && input.marketingConsent === true) {
    body.marketing_consent = {
      accepted: true,
      text_version: MARKETING_CONSENT_TEXT_VERSION,
    };
  }
  return body;
}

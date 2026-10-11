import { CONSENT_TEXT_VERSION } from "../content/consent";
import { checkForDisplay } from "./check-view";
import { isDirectForms } from "./forms-mode";
import {
  createPublicCheck,
  createPublicLead,
  getPublicCheck,
  type PublicCheckInput,
  type PublicLeadInput,
} from "./public-api";
import type { CheckJob } from "./types";

type FetchLike = typeof fetch;

export type CheckFormInput = PublicCheckInput;

export type LeadFormInput = PublicLeadInput;

function bffCheckBody(input: CheckFormInput): Record<string, unknown> {
  const name = input.name?.trim() || undefined;
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  if (name || email || phone) {
    return {
      url: input.url,
      lead: {
        name,
        email,
        phone,
        consent: true,
        consent_text_version: CONSENT_TEXT_VERSION,
      },
    };
  }
  return { url: input.url };
}

function bffLeadBody(input: LeadFormInput): Record<string, unknown> {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone?.trim() || undefined,
    company: input.company?.trim() || undefined,
    url: input.url?.trim() || undefined,
    checkId: input.checkId,
    message: input.message?.trim() || undefined,
    consent: true,
    source: input.source,
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * URL check. Direct mode calls the public API. BFF mode calls this site's
 * /api/checks and does not attach the captcha token.
 */
export async function runCheck(
  input: CheckFormInput,
  fetchImpl: FetchLike = fetch
): Promise<CheckJob> {
  if (isDirectForms()) {
    return createPublicCheck(input, fetchImpl);
  }
  const res = await fetchImpl("/api/checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bffCheckBody(input)),
  });
  if (!res.ok) throw new Error(await readError(res, "Не удалось запустить проверку"));
  return checkForDisplay((await res.json()) as CheckJob);
}

export async function pollCheck(
  id: string,
  previous: CheckJob | null,
  fetchImpl: FetchLike = fetch
): Promise<CheckJob> {
  if (isDirectForms()) {
    return getPublicCheck(id, previous, fetchImpl);
  }
  const res = await fetchImpl(`/api/checks/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res, "Ошибка опроса"));
  return checkForDisplay((await res.json()) as CheckJob);
}

export async function runLead(
  input: LeadFormInput,
  fetchImpl: FetchLike = fetch
): Promise<void> {
  if (isDirectForms()) {
    await createPublicLead(input, fetchImpl);
    return;
  }
  const res = await fetchImpl("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bffLeadBody(input)),
  });
  if (!res.ok) throw new Error(await readError(res, "Ошибка отправки"));
}
